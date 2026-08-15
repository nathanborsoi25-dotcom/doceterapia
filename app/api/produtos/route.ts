import { NextResponse } from "next/server";
import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { produtos, sabores } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/require-admin";
import { mediasPorProduto } from "@/lib/avaliacoes";
import type { Produto, SaborDoDoce } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const rows = await db.select().from(produtos);

  // A nota dos clientes e os recheios vêm junto: o cardápio monta o card
  // inteiro sem precisar de uma segunda ida ao servidor por doce.
  const [medias, todosSabores] = await Promise.all([
    mediasPorProduto(),
    db.select().from(sabores).orderBy(asc(sabores.ordem)),
  ]);

  const porProduto = new Map<string, SaborDoDoce[]>();
  for (const s of todosSabores) {
    const lista = porProduto.get(s.produtoId) ?? [];
    lista.push({
      id: s.id,
      produtoId: s.produtoId,
      nome: s.nome,
      fotoUrl: s.fotoUrl,
      preco: s.preco,
      precoPromocional: s.precoPromocional,
      custo: s.custo,
      estoque: s.estoque,
      disponibilidade: s.disponibilidade as SaborDoDoce["disponibilidade"],
      prazoDias: s.prazoDias,
      ordem: s.ordem,
      ativo: s.ativo,
    });
    porProduto.set(s.produtoId, lista);
  }

  return NextResponse.json(
    rows.map((p) => ({
      ...p,
      criadoEm: p.criadoEm?.toISOString(),
      notaMedia: medias.get(p.id)?.media ?? 0,
      totalAvaliacoes: medias.get(p.id)?.total ?? 0,
      sabores: porProduto.get(p.id) ?? [],
    }))
  );
}

/** Número que pode ficar em branco (preço e estoque do sabor). */
function numeroOuNulo(valor: unknown, minimo = 0): number | null {
  if (valor == null || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? Math.max(minimo, n) : null;
}

// Criar/editar produto: só o admin logado.
export async function POST(req: Request) {
  const negado = await requireAdmin();
  if (negado) return negado;

  const p = (await req.json()) as Produto;
  const values = {
    id: p.id,
    /*
     * `trim()` porque espaço sobrando entra sem avisar e não sai mais: a
     * auditoria achou "    Brownie Celebration" (quatro espaços à esquerda,
     * que jogavam o doce pro topo de qualquer ordenação alfabética) e "Torta
     * de Manteiga Escocesa " com espaço no fim.
     */
    nome: (p.nome ?? "").trim(),
    descricao: p.descricao ?? "",
    sabor: p.sabor ?? "",
    categoria: (p.categoria ?? "").trim().slice(0, 40),
    preco: p.preco ?? 0,
    /*
     * Promoção: zero ou vazio significa "sem promoção", e vira null. Um valor
     * MAIOR que o preço normal é erro de digitação — guardamos assim mesmo
     * (pra ela ver e corrigir), e quem ignora é `lib/promocao.ts`, que só
     * aplica a promoção quando ela é realmente menor.
     */
    precoPromocional: (() => {
      const n = Number(p.precoPromocional);
      return Number.isFinite(n) && n > 0 ? n : null;
    })(),
    custo: Math.max(0, Number(p.custo) || 0),
    fotoUrl: p.fotoUrl ?? "",
    // No máximo 3, sem repetidas e sem vazias. A primeira é a do cardápio.
    fotos: Array.from(
      new Set((Array.isArray(p.fotos) ? p.fotos : []).filter((f) => typeof f === "string" && f))
    ).slice(0, 3),
    disponibilidade: p.disponibilidade,
    prazoDias: p.prazoDias ?? null,
    // Campo vazio = sem controle de estoque (null). Zero é esgotado, então
    // os dois casos precisam continuar distintos até o banco.
    estoque:
      p.estoque == null || p.estoque === ("" as unknown)
        ? null
        : Math.max(0, Math.floor(Number(p.estoque) || 0)),
    ativo: p.ativo ?? true,
  };

  const db = getDb();
  await db.insert(produtos).values(values).onConflictDoUpdate({
    target: produtos.id,
    set: values,
  });

  // Os recheios chegam junto com o doce: a tela salva tudo de uma vez.
  if (Array.isArray(p.sabores)) {
    const recebidos = p.sabores
      .filter((s) => s && typeof s.nome === "string" && s.nome.trim())
      .slice(0, 20)
      .map((s, i) => ({
        id: s.id,
        produtoId: p.id,
        nome: s.nome.trim().slice(0, 60),
        fotoUrl: typeof s.fotoUrl === "string" ? s.fotoUrl : "",
        preco: numeroOuNulo(s.preco),
        // Cada recheio tem a sua promoção.
        precoPromocional: (() => {
          const n = numeroOuNulo(s.precoPromocional);
          return n != null && n > 0 ? n : null;
        })(),
        custo: Math.max(0, Number(s.custo) || 0),
        estoque: (() => {
          const n = numeroOuNulo(s.estoque);
          return n == null ? null : Math.floor(n);
        })(),
        disponibilidade:
          s.disponibilidade === "pronta_entrega" || s.disponibilidade === "sob_encomenda"
            ? s.disponibilidade
            : null,
        // Prazo só faz sentido em recheio sob encomenda.
        prazoDias:
          s.disponibilidade === "sob_encomenda"
            ? Math.max(0, Math.floor(Number(s.prazoDias) || 0))
            : null,
        ordem: i,
        ativo: s.ativo ?? true,
      }));

    // Some do banco o que a Camily tirou da tela.
    const idsQueFicam = recebidos.map((s) => s.id);
    const existentes = await db
      .select({ id: sabores.id })
      .from(sabores)
      .where(eq(sabores.produtoId, p.id));
    const paraApagar = existentes
      .map((s) => s.id)
      .filter((id) => !idsQueFicam.includes(id));
    if (paraApagar.length > 0) {
      await db.delete(sabores).where(inArray(sabores.id, paraApagar));
    }

    for (const sabor of recebidos) {
      const { id: _id, ...atualizacao } = sabor;
      await db
        .insert(sabores)
        .values(sabor)
        .onConflictDoUpdate({ target: sabores.id, set: atualizacao });
    }
  }

  return NextResponse.json({ ok: true });
}
