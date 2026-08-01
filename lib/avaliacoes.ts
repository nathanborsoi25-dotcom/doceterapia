import { eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import { avaliacoes } from "./db/schema";

/**
 * Regras das avaliações dos doces.
 *
 * A média só conta as avaliações VISÍVEIS: quando a Camily esconde uma
 * avaliação abusiva, ela precisa sair da nota também — senão esconder não
 * resolveria nada.
 */

export const NOTA_MINIMA = 1;
export const NOTA_MAXIMA = 5;

export function notaValida(valor: unknown): boolean {
  const n = Number(valor);
  return Number.isInteger(n) && n >= NOTA_MINIMA && n <= NOTA_MAXIMA;
}

export type MediaDoProduto = { media: number; total: number };

/** Média e quantidade de notas de cada doce, num mapa por produtoId. */
export async function mediasPorProduto(): Promise<Map<string, MediaDoProduto>> {
  const linhas = await getDb()
    .select({
      produtoId: avaliacoes.produtoId,
      media: sql<number>`avg(${avaliacoes.nota})::float`,
      total: sql<number>`count(*)::int`,
    })
    .from(avaliacoes)
    .where(eq(avaliacoes.visivel, true))
    .groupBy(avaliacoes.produtoId);

  return new Map(
    linhas.map((l) => [
      l.produtoId,
      // Arredonda em uma casa: "4,7" é o que aparece no cardápio.
      { media: Math.round((l.media ?? 0) * 10) / 10, total: l.total ?? 0 },
    ])
  );
}

/** Só o primeiro nome aparece no cardápio — sobrenome de cliente não é público. */
export function primeiroNome(nome: string): string {
  return (nome ?? "").trim().split(/\s+/)[0] ?? "";
}
