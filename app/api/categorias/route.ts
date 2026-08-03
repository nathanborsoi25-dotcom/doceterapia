import { NextResponse } from "next/server";
import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { categorias, produtos } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

/** As categorias na ordem escolhida pela Camily. Leitura é pública: o
 *  cardápio usa essa ordem pra montar as seções. */
export async function GET() {
  const linhas = await getDb().select().from(categorias).orderBy(asc(categorias.ordem));

  // Quantos doces há em cada uma, pro painel avisar antes de remover.
  const contagem = await getDb()
    .select({ nome: produtos.categoria, total: sql<number>`count(*)::int` })
    .from(produtos)
    .groupBy(produtos.categoria);
  const porNome = new Map(contagem.map((c) => [c.nome, c.total]));

  return NextResponse.json(
    linhas.map((c) => ({
      id: c.id,
      nome: c.nome,
      ordem: c.ordem,
      doces: porNome.get(c.nome) ?? 0,
    }))
  );
}

function nomeLimpo(valor: unknown): string {
  return typeof valor === "string" ? valor.trim().slice(0, 40) : "";
}

/** Cria uma categoria. */
export async function POST(req: Request) {
  const negado = await requireAdmin();
  if (negado) return negado;

  const body = (await req.json().catch(() => ({}))) as { nome?: string };
  const nome = nomeLimpo(body.nome);
  if (!nome) {
    return NextResponse.json({ error: "Escreva o nome da categoria." }, { status: 400 });
  }

  const db = getDb();
  const [existente] = await db.select().from(categorias).where(eq(categorias.nome, nome));
  if (existente) {
    return NextResponse.json({ error: "Já existe uma categoria com esse nome." }, { status: 409 });
  }

  // Entra no fim da lista.
  const [{ maior }] = await db
    .select({ maior: sql<number>`coalesce(max(${categorias.ordem}), -1)::int` })
    .from(categorias);

  await db.insert(categorias).values({
    id: crypto.randomUUID(),
    nome,
    ordem: (maior ?? -1) + 1,
  });

  return NextResponse.json({ ok: true });
}

/**
 * Renomear ou reordenar.
 *
 * Renomear troca o nome nos doces que usam a categoria — eles guardam o NOME,
 * então sem isso ficariam apontando pra uma categoria que não existe mais.
 */
export async function PATCH(req: Request) {
  const negado = await requireAdmin();
  if (negado) return negado;

  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    nome?: string;
    ordem?: Array<{ id: string; ordem: number }>;
  };

  const db = getDb();

  // Reordenação: chega a lista inteira na ordem nova.
  if (Array.isArray(body.ordem)) {
    for (const item of body.ordem) {
      await db
        .update(categorias)
        .set({ ordem: Math.max(0, Math.floor(Number(item.ordem) || 0)) })
        .where(eq(categorias.id, item.id));
    }
    return NextResponse.json({ ok: true });
  }

  const nome = nomeLimpo(body.nome);
  if (!body.id || !nome) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const [atual] = await db.select().from(categorias).where(eq(categorias.id, body.id));
  if (!atual) {
    return NextResponse.json({ error: "Categoria não encontrada." }, { status: 404 });
  }
  if (atual.nome === nome) return NextResponse.json({ ok: true });

  const [conflito] = await db.select().from(categorias).where(eq(categorias.nome, nome));
  if (conflito) {
    return NextResponse.json({ error: "Já existe uma categoria com esse nome." }, { status: 409 });
  }

  await db.update(categorias).set({ nome }).where(eq(categorias.id, body.id));
  await db
    .update(produtos)
    .set({ categoria: nome })
    .where(eq(produtos.categoria, atual.nome));

  return NextResponse.json({ ok: true });
}

/**
 * Remove a categoria. Os doces que estavam nela não somem — ficam sem
 * categoria e caem em "Outros doces" no cardápio.
 */
export async function DELETE(req: Request) {
  const negado = await requireAdmin();
  if (negado) return negado;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });

  const db = getDb();
  const [atual] = await db.select().from(categorias).where(eq(categorias.id, id));
  if (!atual) return NextResponse.json({ ok: true });

  await db.update(produtos).set({ categoria: "" }).where(eq(produtos.categoria, atual.nome));
  await db.delete(categorias).where(eq(categorias.id, id));

  return NextResponse.json({ ok: true });
}
