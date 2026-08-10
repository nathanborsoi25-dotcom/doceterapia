/**
 * Os destaques do topo do cardápio.
 *
 * Antes existia UM banner, guardado em seis colunas soltas (`banner_titulo`,
 * `banner_imagem`…). Agora são vários, num jsonb só — a Camily quer anunciar
 * o combo do Dia das Mães e o desconto do Pix ao mesmo tempo, e criar seis
 * colunas por banner não escalaria.
 *
 * As colunas antigas continuam no banco de propósito: `bannersDaLoja()` cai
 * nelas quando a lista nova está vazia, então o destaque que ela já tinha
 * configurado não some no dia do deploy.
 */

export type BannerDaLoja = {
  id: string;
  ativo: boolean;
  titulo: string;
  descricao: string;
  /** Selo de urgência: "Só até domingo!". Opcional. */
  selo: string;
  imagem: string;
  /** Para onde leva o toque. Vazio vira o cardápio. */
  link: string;
};

/** Teto de banners. Mais que isso ninguém arrasta até o fim. */
export const MAXIMO_BANNERS = 6;

export function bannerVazio(): BannerDaLoja {
  return {
    id: `b${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    ativo: true,
    titulo: "",
    descricao: "",
    selo: "",
    imagem: "",
    link: "/catalogo",
  };
}

function texto(v: unknown, limite: number): string {
  return typeof v === "string" ? v.trim().slice(0, limite) : "";
}

/**
 * Peneira o que vem do navegador antes de gravar no jsonb. Sem isso, o campo
 * viraria porta pra guardar qualquer coisa no banco.
 */
export function limparBanners(v: unknown): BannerDaLoja[] {
  if (!Array.isArray(v)) return [];

  return v
    .slice(0, MAXIMO_BANNERS)
    .map((item, i): BannerDaLoja => {
      const b = (item ?? {}) as Record<string, unknown>;
      return {
        id: texto(b.id, 40) || `b${i}`,
        ativo: b.ativo !== false,
        titulo: texto(b.titulo, 80),
        descricao: texto(b.descricao, 200),
        selo: texto(b.selo, 40),
        imagem: texto(b.imagem, 500),
        link: texto(b.link, 200) || "/catalogo",
      };
    })
    // Banner sem título nem imagem não é banner, é linha em branco.
    .filter((b) => b.titulo || b.imagem);
}

type ConfigComBanner = {
  banners?: unknown;
  bannerAtivo?: boolean;
  bannerTitulo?: string;
  bannerDescricao?: string;
  bannerSelo?: string;
  bannerImagem?: string;
  bannerLink?: string;
};

/**
 * A lista de banners da loja, já com o destaque antigo convertido quando a
 * lista nova ainda não existe. É por aqui que o painel e o cardápio leem.
 */
export function bannersDaLoja(config: ConfigComBanner | null | undefined): BannerDaLoja[] {
  const lista = limparBanners(config?.banners);
  if (lista.length > 0) return lista;

  // Compatibilidade: o banner único de antes vira o primeiro da lista.
  if (config?.bannerTitulo || config?.bannerImagem) {
    return [
      {
        id: "banner-antigo",
        ativo: config.bannerAtivo !== false,
        titulo: config.bannerTitulo ?? "",
        descricao: config.bannerDescricao ?? "",
        selo: config.bannerSelo ?? "",
        imagem: config.bannerImagem ?? "",
        link: config.bannerLink || "/catalogo",
      },
    ];
  }

  return [];
}

/** Só os que a Camily deixou ligados e têm o que mostrar. */
export function bannersVisiveis(config: ConfigComBanner | null | undefined): BannerDaLoja[] {
  return bannersDaLoja(config).filter((b) => b.ativo && (b.titulo || b.imagem));
}
