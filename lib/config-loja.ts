import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { configLoja } from "./db/schema";

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
