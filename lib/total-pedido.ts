import { descontoDoPix } from "./desconto-pix";
import { getConfigLoja } from "./config-loja";
import type { FormaPagamento, ItemPedido } from "./types";

/**
 * Quanto cobrar de um pedido JÁ GRAVADO, na forma de pagamento escolhida agora.
 *
 * Existe porque o valor nunca pode vir do navegador: quem paga dentro do site
 * manda só o id do pedido, e a conta é refeita aqui a partir do que está no
 * banco. É a mesma regra que impede alguém de comprar uma torta de R$ 65,00
 * por R$ 1,00 na criação do pedido.
 *
 * ⚠️ **O desconto do Pix é RECALCULADO, nunca aproveitado do pedido.** Abrir
 * no cartão mantendo o abatimento do Pix faria a Camily pagar os 4% E a taxa
 * cheia do cartão — o mesmo buraco que a retomada de pagamento já fecha.
 */
export async function totalDoPedido(
  pedido: {
    itens: ItemPedido[];
    valorFrete: number;
    desconto: number;
  },
  forma: FormaPagamento
): Promise<number> {
  const configLoja = await getConfigLoja();

  const subtotal = pedido.itens.reduce(
    (soma, i) => soma + i.precoUnitario * i.quantidade,
    0
  );
  const semDesconto = Math.max(0, subtotal - pedido.desconto + pedido.valorFrete);
  const abatimentoPix = descontoDoPix(forma, semDesconto, configLoja.descontoPix);

  // Duas casas: o Mercado Pago recusa valor com sobra de fração binária.
  return Number(Math.max(0, semDesconto - abatimentoPix).toFixed(2));
}
