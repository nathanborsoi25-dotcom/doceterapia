import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { avaliacoes, clientes, produtos } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/require-admin";
import type { Avaliacao } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Todas as avaliações, inclusive as escondidas — só a Camily vê esta lista. */
export async function GET() {
  const negado = await requireAdmin();
  if (negado) return negado;

  const linhas = await getDb()
    .select({ a: avaliacoes, nome: clientes.nome, doce: produtos.nome })
    .from(avaliacoes)
    .leftJoin(clientes, eq(avaliacoes.clienteId, clientes.id))
    .leftJoin(produtos, eq(avaliacoes.produtoId, produtos.id))
    .orderBy(desc(avaliacoes.criadoEm));

  const resultado: Avaliacao[] = linhas.map(({ a, nome, doce }) => ({
    id: a.id,
    produtoId: a.produtoId,
    pedidoId: a.pedidoId,
    nota: a.nota,
    comentario: a.comentario,
    criadoEm: a.criadoEm.toISOString(),
    // No painel ela vê o nome inteiro: é a cliente dela.
    clienteNome: nome ?? "Cliente",
    visivel: a.visivel,
    produtoNome: doce ?? "(doce removido)",
  }));

  return NextResponse.json(resultado);
}

/**
 * Esconder ou mostrar uma avaliação. Esconder não apaga: a avaliação continua
 * guardada (e sai da média), então dá pra voltar atrás se foi engano.
 */
export async function PATCH(req: Request) {
  const negado = await requireAdmin();
  if (negado) return negado;

  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    visivel?: boolean;
  };
  if (!body.id || typeof body.visivel !== "boolean") {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  await getDb()
    .update(avaliacoes)
    .set({ visivel: body.visivel })
    .where(eq(avaliacoes.id, body.id));

  return NextResponse.json({ ok: true });
}
