import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { configLoja } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/require-admin";
import { getConfigLoja, ID_CONFIG } from "@/lib/config-loja";

export const dynamic = "force-dynamic";

/**
 * Ajustes da loja: regras de pontuação e o banner da página inicial.
 * A leitura é pública porque o banner aparece pro cliente; a escrita é só
 * da Camily.
 */
export async function GET() {
  return NextResponse.json(await getConfigLoja());
}

function texto(v: unknown, limite: number): string {
  return typeof v === "string" ? v.trim().slice(0, limite) : "";
}

export async function PUT(req: Request) {
  const negado = await requireAdmin();
  if (negado) return negado;

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const valores = {
    id: ID_CONFIG,
    pontosPorReal: Math.max(0, Number(b.pontosPorReal) || 0),
    pontosPorAvaliacao: Math.max(0, Math.floor(Number(b.pontosPorAvaliacao) || 0)),
    pontosPorStory: Math.max(0, Math.floor(Number(b.pontosPorStory) || 0)),
    bannerAtivo: Boolean(b.bannerAtivo),
    bannerTitulo: texto(b.bannerTitulo, 80),
    bannerDescricao: texto(b.bannerDescricao, 200),
    bannerSelo: texto(b.bannerSelo, 40),
    bannerImagem: texto(b.bannerImagem, 500),
    bannerLink: texto(b.bannerLink, 200) || "/catalogo",
  };

  const { id: _id, ...atualizacao } = valores;
  await getDb()
    .insert(configLoja)
    .values(valores)
    .onConflictDoUpdate({ target: configLoja.id, set: atualizacao });

  return NextResponse.json({ ok: true });
}
