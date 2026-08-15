import { unstable_noStore as naoGuardar } from "next/cache";
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
  /*
   * ⚠️ Sem isto a página serve dados velhos PARA SEMPRE.
   *
   * O driver do Neon conversa com o banco por `fetch`, e o Next embrulha o
   * `fetch` global com cache próprio: a leitura do banco vira resposta
   * guardada. `export const dynamic = "force-dynamic"` na página **não**
   * resolve — ele age sobre a renderização, não sobre esta leitura.
   *
   * Foi o que aconteceu com o Box mini cookies: a Camily cadastrou o recheio
   * de ganache, o banco recebeu, a API devolvia os dois, e a página do doce
   * continuou mostrando só a Nutella. Mesmo remédio já aplicado na rota do
   * frete em 13/08.
   */
  naoGuardar();

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
      precoPromocional: linha.precoPromocional,
      fotoUrl: linha.fotoUrl,
      fotos: linha.fotos ?? [],
      disponibilidade: linha.disponibilidade as Produto["disponibilidade"],
      prazoDias: linha.prazoDias ?? undefined,
      estoque: linha.estoque,
      ativo: linha.ativo,
      notaMedia: media?.media ?? 0,
      totalAvaliacoes: media?.total ?? 0,
      /*
       * O recheio vai INTEIRO. Esta lista era montada campo a campo e
       * esquecia `disponibilidade` e `prazoDias`, então a tela do doce dizia
       * "pronta entrega" num recheio que a Camily marcou como encomenda de 7
       * dias — e agora esqueceria a promoção também.
       */
      sabores: recheios.map((s) => ({
        id: s.id,
        produtoId: s.produtoId,
        nome: s.nome,
        fotoUrl: s.fotoUrl,
        preco: s.preco,
        precoPromocional: s.precoPromocional,
        custo: s.custo,
        estoque: s.estoque,
        disponibilidade: s.disponibilidade as Produto["disponibilidade"] | null,
        prazoDias: s.prazoDias,
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
