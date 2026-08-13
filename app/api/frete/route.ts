import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { configFrete } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/require-admin";
import { geocodificarTexto } from "@/lib/geocode";
import { configuracaoFretePadrao } from "@/lib/shipping";
import type { ConfiguracaoFrete, OrigemFrete } from "@/lib/types";

export const dynamic = "force-dynamic";

const ID = "default";

export async function GET() {
  const db = getDb();
  const rows = await db.select().from(configFrete).where(eq(configFrete.id, ID));
  if (rows.length === 0) {
    return NextResponse.json(configuracaoFretePadrao);
  }
  const r = rows[0];
  return NextResponse.json({
    origem: r.origem,
    origemFimDeSemana: r.origemFimDeSemana ?? null,
    freteGratisAcimaDe: r.freteGratisAcimaDe ?? 0,
    faixas: r.faixas,
  });
}

/**
 * Localiza o endereço no mapa antes de gravar.
 *
 * Se o Nominatim não achar, ficam as coordenadas que já vieram — trocar por
 * zero faria a distância ser medida a partir do Golfo da Guiné, e todo mundo
 * cairia fora da área de entrega de uma vez.
 */
async function comCoordenadas(origem: OrigemFrete): Promise<OrigemFrete> {
  const coords = await geocodificarTexto(origem.endereco);
  return coords ? { ...origem, lat: coords.lat, lng: coords.lng } : origem;
}

// Alterar a configuração de frete: só o admin logado.
export async function PUT(req: Request) {
  const negado = await requireAdmin();
  if (negado) return negado;

  const config = (await req.json()) as ConfiguracaoFrete;

  const origem = await comCoordenadas(config.origem);

  /*
   * O endereço de fim de semana é opcional: campo em branco volta a nulo, e
   * aí a entrega sai da origem única todos os dias. Sem esse caminho de
   * volta, a Camily não teria como desfazer a troca depois de ligá-la.
   */
  const bruta = config.origemFimDeSemana;
  const origemFimDeSemana =
    bruta && typeof bruta.endereco === "string" && bruta.endereco.trim()
      ? await comCoordenadas({ ...bruta, endereco: bruta.endereco.trim() })
      : null;

  // Valor negativo ou lixo digitado vira zero, que é "sem frete grátis".
  const minimo = Number(config.freteGratisAcimaDe);
  const freteGratisAcimaDe = Number.isFinite(minimo) && minimo > 0 ? minimo : 0;

  const valores = {
    origem,
    origemFimDeSemana,
    freteGratisAcimaDe,
    faixas: config.faixas,
  };

  const db = getDb();
  await db
    .insert(configFrete)
    .values({ id: ID, ...valores })
    .onConflictDoUpdate({
      target: configFrete.id,
      set: valores,
    });

  return NextResponse.json({ ok: true, origem, origemFimDeSemana });
}
