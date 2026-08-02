import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { clientes, stories } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/require-admin";
import { lancarPontos } from "@/lib/fidelidade";
import { getConfigLoja } from "@/lib/config-loja";

export const dynamic = "force-dynamic";

/** Todos os stories enviados, com o print e quem mandou. */
export async function GET() {
  const negado = await requireAdmin();
  if (negado) return negado;

  const linhas = await getDb()
    .select({ s: stories, nome: clientes.nome, telefone: clientes.telefone })
    .from(stories)
    .leftJoin(clientes, eq(stories.clienteId, clientes.id))
    .orderBy(desc(stories.criadoEm));

  return NextResponse.json(
    linhas.map(({ s, nome, telefone }) => ({
      id: s.id,
      pedidoId: s.pedidoId,
      imagemUrl: s.imagemUrl,
      arroba: s.arroba,
      situacao: s.situacao,
      pontosCreditados: s.pontosCreditados,
      criadoEm: s.criadoEm.toISOString(),
      clienteNome: nome ?? "Cliente",
      clienteTelefone: telefone ?? null,
    }))
  );
}

/**
 * A Camily aprovando ou recusando um story.
 *
 * Os pontos entram SÓ aqui, no aprovar — e uma vez só: se ela clicar duas
 * vezes, a segunda não credita de novo, porque a situação já saiu de
 * "pendente".
 */
export async function PATCH(req: Request) {
  const negado = await requireAdmin();
  if (negado) return negado;

  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    aprovar?: boolean;
    motivo?: string;
  };
  if (!body.id || typeof body.aprovar !== "boolean") {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const db = getDb();
  const [story] = await db.select().from(stories).where(eq(stories.id, body.id));
  if (!story) {
    return NextResponse.json({ error: "Story não encontrado." }, { status: 404 });
  }
  if (story.situacao !== "pendente") {
    return NextResponse.json(
      { error: "Este story já foi decidido." },
      { status: 409 }
    );
  }

  if (!body.aprovar) {
    await db
      .update(stories)
      .set({
        situacao: "recusado",
        motivoRecusa: (body.motivo ?? "").slice(0, 200) || null,
        decididoEm: new Date(),
      })
      .where(eq(stories.id, body.id));
    return NextResponse.json({ ok: true, pontos: 0 });
  }

  const config = await getConfigLoja();
  const pontos = Math.max(0, Math.round(config.pontosPorStory ?? 0));

  await db
    .update(stories)
    .set({ situacao: "aprovado", pontosCreditados: pontos, decididoEm: new Date() })
    .where(eq(stories.id, body.id));

  if (pontos > 0) {
    await lancarPontos({
      clienteId: story.clienteId,
      quantidade: pontos,
      motivo: "story",
      descricao: "Story postado marcando a Doceterapia",
      pedidoId: story.pedidoId,
    });
  }

  return NextResponse.json({ ok: true, pontos });
}
