import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { configFrete } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/require-admin";
import { geocodificarTexto } from "@/lib/geocode";
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

// Alterar a configuração de frete: só o admin logado.
export async function PUT(req: Request) {
  const negado = await requireAdmin();
  if (negado) return negado;

  const config = (await req.json()) as ConfiguracaoFrete;

  // Geocodifica o endereço da loja pra as distâncias saírem certas.
  // Se o Nominatim não achar, mantém as coordenadas que já vieram.
  const coords = await geocodificarTexto(config.origem.endereco);
  const origem = coords
    ? { ...config.origem, lat: coords.lat, lng: coords.lng }
    : config.origem;

  const db = getDb();
  await db
    .insert(configFrete)
    .values({ id: ID, origem, faixas: config.faixas })
    .onConflictDoUpdate({
      target: configFrete.id,
      set: { origem, faixas: config.faixas },
    });
  return NextResponse.json({ ok: true, origem });
}
