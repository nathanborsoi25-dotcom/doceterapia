import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { cupons } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

/** Liga e desliga o cupom. Não apagamos, pra não sumir com o histórico. */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const negado = await requireAdmin();
  if (negado) return negado;

  const { ativo } = (await req.json().catch(() => ({}))) as { ativo?: boolean };
  if (typeof ativo !== "boolean") {
    return NextResponse.json({ error: "Informe se o cupom fica ativo." }, { status: 400 });
  }

  await getDb().update(cupons).set({ ativo }).where(eq(cupons.id, params.id));
  return NextResponse.json({ ok: true });
}
