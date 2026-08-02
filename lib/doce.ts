import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "./db";
import { avaliacoes, clientes, produtos, sabores } from "./db/schema";
import { mediasPorProduto, primeiroNome } from "./avaliacoes";
import { idDoSlug } from "./slug";
import type { Avaliacao, Produto } from "./types";

/**
 * Busca do doce para a página dele. Roda no servidor, direto no banco — a
 * página precisa vir pronta no HTML pra funcionar quando alguém abre o link
 * compartilhado no Instagram (e pra aparecer no Google).
 */
export type DoceCompleto = {
  produto: Produto;
  avaliacoes: Avaliacao[];
};

export async function buscarDocePorSlug(slug: string): Promise<DoceCompleto | null> {
  const id = idDoSlug(slug);
  if (!id) return null;

  const db = getDb();
  const [linha] = await db.select().from(produtos).where(eq(produtos.id, id));
  if (!linha || !linha.ativo) return null;

  const [medias, notas, recheios] = await Promise.all([
    mediasPorProduto(),
    db
      .select({ a: avaliacoes, nome: clientes.nome })
      .from(avaliacoes)
      .leftJoin(clientes, eq(avaliacoes.clienteId, clientes.id))
      .where(and(eq(avaliacoes.produtoId, id), eq(avaliacoes.visivel, true)))
      .orderBy(desc(avaliacoes.criadoEm)),
    db.select().from(sabores).where(eq(sabores.produtoId, id)).orderBy(asc(sabores.ordem)),
  ]);

  const media = medias.get(id);

  return {
    produto: {
      id: linha.id,
      nome: linha.nome,
      descricao: linha.descricao,
      sabor: linha.sabor,
      preco: linha.preco,
      fotoUrl: linha.fotoUrl,
      fotos: linha.fotos ?? [],
      disponibilidade: linha.disponibilidade as Produto["disponibilidade"],
      prazoDias: linha.prazoDias ?? undefined,
      estoque: linha.estoque,
      ativo: linha.ativo,
      notaMedia: media?.media ?? 0,
      totalAvaliacoes: media?.total ?? 0,
      sabores: recheios.map((s) => ({
        id: s.id,
        produtoId: s.produtoId,
        nome: s.nome,
        fotoUrl: s.fotoUrl,
        preco: s.preco,
        estoque: s.estoque,
        ordem: s.ordem,
        ativo: s.ativo,
      })),
    },
    avaliacoes: notas.map(({ a, nome }) => ({
      id: a.id,
      produtoId: a.produtoId,
      pedidoId: a.pedidoId,
      nota: a.nota,
      comentario: a.comentario,
      criadoEm: a.criadoEm.toISOString(),
      clienteNome: primeiroNome(nome ?? "Cliente"),
    })),
  };
}
