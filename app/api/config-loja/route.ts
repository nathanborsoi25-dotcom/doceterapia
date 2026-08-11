import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { configLoja } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/require-admin";
import { getConfigLoja, ID_CONFIG } from "@/lib/config-loja";
import { limparBanners } from "@/lib/banners";
import { percentualDoPix } from "@/lib/desconto-pix";
import { CAMPOS_POLITICA } from "@/lib/politica";
import { limparPontos } from "@/lib/retirada";

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

/**
 * Textos da política: só aceita as chaves que a página conhece, cada uma com
 * texto puro e tamanho limitado. Sem essa peneira, o painel viraria porta pra
 * gravar qualquer coisa no jsonb.
 */
function textosDaPolitica_(v: unknown): Record<string, string> {
  if (!v || typeof v !== "object") return {};
  const entrada = v as Record<string, unknown>;
  const limpo: Record<string, string> = {};
  for (const { chave } of CAMPOS_POLITICA) {
    const valor = texto(entrada[chave], 2000);
    if (valor) limpo[chave] = valor;
  }
  return limpo;
}

export async function PUT(req: Request) {
  const negado = await requireAdmin();
  if (negado) return negado;

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  /**
   * Cada tela do painel salva por esta mesma rota mandando SÓ os campos dela:
   * "Sobre mim" manda foto e telefone, fidelidade manda os pontos, promoções
   * manda o banner. Por isso o que não veio no pedido continua como está —
   * antes, salvar a foto zeraria os pontos por real e apagaria o banner.
   */
  const atual = await getConfigLoja();
  function manter<T>(valor: unknown, antigo: T, converter: (v: unknown) => T): T {
    return valor === undefined ? antigo : converter(valor);
  }

  const valores = {
    id: ID_CONFIG,
    sobreFoto: manter(b.sobreFoto, atual.sobreFoto, (v) => texto(v, 500)),
    sobreTexto: manter(b.sobreTexto, atual.sobreTexto, (v) => texto(v, 600)),
    telefone: manter(b.telefone, atual.telefone, (v) => texto(v, 30)),
    politica: manter(b.politica, atual.politica, textosDaPolitica_),
    pontosRetirada: manter(b.pontosRetirada, atual.pontosRetirada, limparPontos),
    pontosPorReal: manter(b.pontosPorReal, atual.pontosPorReal, (v) =>
      Math.max(0, Number(v) || 0)
    ),
    pontosPorAvaliacao: manter(b.pontosPorAvaliacao, atual.pontosPorAvaliacao, (v) =>
      Math.max(0, Math.floor(Number(v) || 0))
    ),
    pontosPorStory: manter(b.pontosPorStory, atual.pontosPorStory, (v) =>
      Math.max(0, Math.floor(Number(v) || 0))
    ),
    descontoPix: manter(b.descontoPix, atual.descontoPix, percentualDoPix),
    banners: manter(b.banners, atual.banners, limparBanners),
    bannerAtivo: manter(b.bannerAtivo, atual.bannerAtivo, Boolean),
    bannerTitulo: manter(b.bannerTitulo, atual.bannerTitulo, (v) => texto(v, 80)),
    bannerDescricao: manter(b.bannerDescricao, atual.bannerDescricao, (v) => texto(v, 200)),
    bannerSelo: manter(b.bannerSelo, atual.bannerSelo, (v) => texto(v, 40)),
    bannerImagem: manter(b.bannerImagem, atual.bannerImagem, (v) => texto(v, 500)),
    bannerLink: manter(
      b.bannerLink,
      atual.bannerLink,
      (v) => texto(v, 200) || "/catalogo"
    ),
  };

  const { id: _id, ...atualizacao } = valores;
  await getDb()
    .insert(configLoja)
    .values(valores)
    .onConflictDoUpdate({ target: configLoja.id, set: atualizacao });

  return NextResponse.json({ ok: true });
}
