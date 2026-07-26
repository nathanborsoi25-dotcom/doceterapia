import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { pedidos } from "@/lib/db/schema";
import type { Pedido } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { status } = (await req.json()) as { status: Pedido["status"] };
  const db = getDb();
  await db.update(pedidos).set({ status }).where(eq(pedidos.id, params.id));
  return NextResponse.json({ ok: true });
}
