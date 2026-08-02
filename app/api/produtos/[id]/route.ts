import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { produtos, sabores } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const negado = await requireAdmin();
  if (negado) return negado;

  const db = getDb();
  // Os recheios saem junto com o doce, senão ficariam órfãos no banco.
  await db.delete(sabores).where(eq(sabores.produtoId, params.id));
  await db.delete(produtos).where(eq(produtos.id, params.id));
  return NextResponse.json({ ok: true });
}
