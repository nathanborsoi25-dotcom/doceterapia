import type { FormaPagamento } from "./types";

/**
 * O que o Mercado Pago fica de cada venda.
 *
 * Percentuais da aba **Checkout** do painel do Mercado Pago, com recebimento
 * na hora, conferidos em 08/08/2026. É a aba que vale: a da maquininha e a do
 * link de pagamento cobram diferente, e o site usa o Checkout Pro.
 *
 * Se o Mercado Pago mudar a tabela, é só aqui que muda.
 */
export const TAXAS_MP: Record<FormaPagamento, number> = {
  pix: 0.0099, // 0,99%
  credito: 0.0498, // 4,98% à vista
  /*
   * O débito saiu do site (não existe no Checkout Pro), mas pedidos antigos
   * foram gravados com ele. Cobramos a taxa do crédito para não subestimar
   * o desconto — errar para menos no lucro é pior do que errar para mais.
   */
  debito: 0.0498,
};

/** Quanto o Mercado Pago cobra por uma venda desse valor nessa forma. */
export function taxaMercadoPago(forma: FormaPagamento, valorPago: number): number {
  if (valorPago <= 0) return 0;
  return valorPago * (TAXAS_MP[forma] ?? TAXAS_MP.credito);
}

/**
 * A taxa incide sobre o TOTAL cobrado — doces mais frete, menos o desconto do
 * cupom. Ou seja: no crédito, a Camily também perde ~5% do frete, que ela
 * repassa inteiro ao entregador.
 */
export function totalCobrado(
  subtotal: number,
  valorFrete: number,
  desconto = 0
): number {
  return Math.max(0, subtotal + valorFrete - desconto);
}

/** "0,99%" / "4,98%" — para escrever o percentual na tela. */
export function percentualDaTaxa(forma: FormaPagamento): string {
  return `${((TAXAS_MP[forma] ?? 0) * 100).toFixed(2).replace(".", ",")}%`;
}
