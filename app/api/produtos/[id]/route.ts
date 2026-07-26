import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { produtos } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const negado = await requireAdmin();
  if (negado) return negado;

  const db = getDb();
  await db.delete(produtos).where(eq(produtos.id, params.id));
  return NextResponse.json({ ok: true });
}
