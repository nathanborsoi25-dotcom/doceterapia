import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { configLoja } from "./db/schema";

export const ID_CONFIG = "default";

export type ConfigLoja = typeof configLoja.$inferSelect;

/** Valores usados enquanto a Camily não ajustou nada no painel. */
export const CONFIG_PADRAO: ConfigLoja = {
  id: ID_CONFIG,
  pontosPorReal: 1,
  pontosPorAvaliacao: 10,
  pontosPorStory: 15,
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
