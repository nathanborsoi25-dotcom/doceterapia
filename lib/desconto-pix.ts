/**
 * O desconto de quem paga no Pix.
 *
 * Não é cupom: é automático, aparece na hora de pagar e vale pra todo mundo.
 * O motivo é a diferença de taxa — o Pix custa 0,99% e o crédito 4,98%, então
 * devolver ~4% para quem paga no Pix sai praticamente de graça para a Camily
 * e ainda faz o dinheiro cair na hora, em vez de esperar o cartão.
 *
 * Incide sobre o TOTAL cobrado (doces + frete, menos o cupom), que é a mesma
 * base da taxa do Mercado Pago. É isso que faz as duas formas empatarem.
 */

/** Quanto vale o desconto quando a Camily nunca mexeu no painel. */
export const DESCONTO_PIX_PADRAO = 4;

/** Teto de segurança: acima disso a venda passaria a dar prejuízo. */
const MAXIMO = 50;

/** Deixa o percentual dentro do que faz sentido. Zero desliga o desconto. */
export function percentualDoPix(valor: unknown): number {
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Math.round(n * 100) / 100, MAXIMO);
}

/**
 * Quanto o Pix abate deste pedido. Só no Pix, e nunca mais que o próprio
 * total — o pedido jamais pode fechar em valor negativo.
 */
export function descontoDoPix(
  formaPagamento: string,
  totalCobrado: number,
  percentual: number
): number {
  if (formaPagamento !== "pix") return 0;
  const pct = percentualDoPix(percentual);
  if (pct <= 0 || totalCobrado <= 0) return 0;
  const bruto = (totalCobrado * pct) / 100;
  return Math.min(Math.round(bruto * 100) / 100, totalCobrado);
}

/** "4%" ou "4,5%" — o percentual do jeito que a pessoa lê. */
export function percentualEscrito(percentual: number): string {
  const pct = percentualDoPix(percentual);
  return `${String(pct).replace(".", ",")}%`;
}
