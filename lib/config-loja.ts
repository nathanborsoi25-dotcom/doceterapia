import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { configLoja } from "./db/schema";
import { DESCONTO_PIX_PADRAO } from "./desconto-pix";
import { ENTREGA_PADRAO } from "./entrega-horario";
import { FUNCIONAMENTO_PADRAO } from "./funcionamento";

export const ID_CONFIG = "default";

export type ConfigLoja = typeof configLoja.$inferSelect;

/**
 * O que o rodapé mostra enquanto a Camily não escreveu o dela. É o texto que
 * estava fixo no código antes desta tela existir — assim o site nunca aparece
 * com o "quem faz" em branco.
 */
export const SOBRE_PADRAO = {
  texto:
    "Feito à mão, com carinho, para adoçar o seu dia. Cada doce da Doceterapia carrega um pouquinho de mim — obrigada por fazer parte dessa história.",
  telefone: "(43) 99634-7895",
};

/** Valores usados enquanto a Camily não ajustou nada no painel. */
export const CONFIG_PADRAO: ConfigLoja = {
  id: ID_CONFIG,
  sobreFoto: "",
  sobreTexto: "",
  telefone: "",
  politica: {},
  pontosRetirada: [],
  pontosPorReal: 1,
  pontosPorAvaliacao: 10,
  pontosPorStory: 15,
  descontoPix: DESCONTO_PIX_PADRAO,
  funcionamento: FUNCIONAMENTO_PADRAO,
  entrega: ENTREGA_PADRAO,
  /** Loja sem linha salva não tem promoção nova pra anunciar. */
  promocoesEm: null,
  /** Nada pausado: o cardápio mostra a pronta entrega de sempre. */
  pausaProntaEntrega: null,
  banners: [],
  bannerAtivo: false,
  bannerTitulo: "",
  bannerDescricao: "",
  bannerSelo: "",
  bannerImagem: "",
  bannerLink: "/catalogo",
};

/** Lê os ajustes da loja, caindo no padrão quando ainda não há linha salva. */
export async function getConfigLoja(): Promise<ConfigLoja> {
  const [linha] = await getDb()
    .select()
    .from(configLoja)
    .where(eq(configLoja.id, ID_CONFIG));
  return linha ?? CONFIG_PADRAO;
}

/**
 * Carimba a hora em que a tela de promoções mudou.
 *
 * Chamado quando a Camily salva um banner, cria um cupom ou põe um prêmio
 * novo no catálogo. É esse carimbo que acende a bolinha em "Promoções" — a
 * cliente guarda no próprio navegador quando viu a tela pela última vez.
 *
 * Nunca lança: é um enfeite de navegação, e derrubar a criação de um cupom
 * por causa dele seria trocar o essencial pelo acessório.
 */
export async function marcarPromocoesAtualizadas(): Promise<void> {
  try {
    await getDb()
      .insert(configLoja)
      .values({ id: ID_CONFIG, promocoesEm: new Date() })
      .onConflictDoUpdate({
        target: configLoja.id,
        set: { promocoesEm: new Date() },
      });
  } catch (e) {
    console.error("Não consegui carimbar a mudança nas promoções:", e);
  }
}

/**
 * O "quem faz" pronto pra tela, já com o padrão no lugar do que estiver vazio.
 *
 * Existe pra ninguém precisar lembrar do `|| SOBRE_PADRAO` em cada lugar que
 * mostra o rodapé — esquecer disso deixaria a loja sem telefone justamente na
 * tela onde a cliente vai procurar por ele.
 */
export function sobreDaLoja(config: Pick<ConfigLoja, "sobreFoto" | "sobreTexto" | "telefone">) {
  return {
    foto: config.sobreFoto || "",
    texto: config.sobreTexto || SOBRE_PADRAO.texto,
    telefone: config.telefone || SOBRE_PADRAO.telefone,
  };
}
