import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { configFrete } from "@/lib/db/schema";
import { configuracaoFretePadrao } from "@/lib/shipping";
import type { ConfiguracaoFrete } from "@/lib/types";

export const dynamic = "force-dynamic";

const ID = "default";

export async function GET() {
  const db = getDb();
  const rows = await db.select().from(configFrete).where(eq(configFrete.id, ID));
  if (rows.length === 0) {
    return NextResponse.json(configuracaoFretePadrao);
  }
  const r = rows[0];
  return NextResponse.json({ origem: r.origem, faixas: r.faixas });
}

export async function PUT(req: Request) {
  const config = (await req.json()) as ConfiguracaoFrete;
  const db = getDb();
  await db
    .insert(configFrete)
    .values({ id: ID, origem: config.origem, faixas: config.faixas })
    .onConflictDoUpdate({
      target: configFrete.id,
      set: { origem: config.origem, faixas: config.faixas },
    });
  return NextResponse.json({ ok: true });
}
