import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { pedidos } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/require-admin";
import { avisarMudancaDeStatus } from "@/lib/avisar-cliente";
import type { Pedido } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const negado = await requireAdmin();
  if (negado) return negado;

  const { status } = (await req.json()) as { status: Pedido["status"] };
  const db = getDb();
  await db.update(pedidos).set({ status }).where(eq(pedidos.id, params.id));

  // Avisa o cliente da mudança. Não trava a resposta: se o e-mail falhar, a
  // situação do pedido já foi salva de qualquer jeito.
  await avisarMudancaDeStatus(params.id, status);

  return NextResponse.json({ ok: true });
}
