import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { recompensas } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/require-admin";
import { marcarPromocoesAtualizadas } from "@/lib/config-loja";

export const dynamic = "force-dynamic";

/** O catálogo é público: o cliente precisa ver pelo que trocar os pontos. */
export async function GET() {
  const linhas = await getDb()
    .select()
    .from(recompensas)
    .orderBy(asc(recompensas.pontos));
  return NextResponse.json(
    linhas.map((r) => ({ ...r, criadoEm: r.criadoEm.toISOString() }))
  );
}

export async function POST(req: Request) {
  const negado = await requireAdmin();
  if (negado) return negado;

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const nome = String(b.nome ?? "").trim().slice(0, 100);
  const pontos = Math.floor(Number(b.pontos) || 0);

  if (!nome) {
    return NextResponse.json({ error: "Dê um nome à recompensa." }, { status: 400 });
  }
  if (pontos <= 0) {
    return NextResponse.json(
      { error: "Informe quantos pontos custa para resgatar." },
      { status: 400 }
    );
  }

  const id = String(b.id ?? "") || crypto.randomUUID();
  const valores = {
    id,
    nome,
    descricao: String(b.descricao ?? "").trim().slice(0, 300),
    pontos,
    ativo: b.ativo === undefined ? true : Boolean(b.ativo),
  };

  const { id: _id, ...atualizacao } = valores;
  await getDb()
    .insert(recompensas)
    .values(valores)
    .onConflictDoUpdate({ target: recompensas.id, set: atualizacao });

  // Prêmio novo no catálogo acende a bolinha em "Promoções".
  await marcarPromocoesAtualizadas();

  return NextResponse.json({ ok: true, id });
}

export async function DELETE(req: Request) {
  const negado = await requireAdmin();
  if (negado) return negado;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Recompensa não informada." }, { status: 400 });

  await getDb().delete(recompensas).where(eq(recompensas.id, id));
  return NextResponse.json({ ok: true });
}
