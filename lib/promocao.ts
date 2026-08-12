import { precoDoSabor } from "./sabores";
import type { ItemPedido, Produto, SaborDoDoce } from "./types";

/**
 * Preço de promoção do doce.
 *
 * A Camily preenche um segundo preço; enquanto ele estiver lá, é ele que o
 * cliente paga, e o preço cheio aparece riscado ao lado. Apagar o campo tira
 * a promoção — não há data de validade, ela liga e desliga na mão.
 *
 * **Doce em promoção não aceita cupom.** Dois descontos em cima do mesmo doce
 * comem a margem inteira, e o cupom foi feito para trazer gente de volta, não
 * para somar com a oferta. O desconto do Pix continua valendo em tudo: aquele
 * não é desconto de verdade, é a diferença de taxa que ela deixa de pagar.
 */

type ComPreco = Pick<Produto, "preco" | "precoPromocional">;
type SaborComPreco = Pick<SaborDoDoce, "preco" | "precoPromocional">;

/**
 * Preço promocional que vale para a escolha atual.
 *
 * Com recheios, quem manda é o recheio: cada um tem o seu, e é possível pôr
 * só o de Nutella em oferta. `null` quer dizer "não está em promoção".
 */
export function promocaoDoSabor(
  produto: ComPreco,
  sabor?: SaborComPreco | null
): number | null {
  const valor = sabor ? sabor.precoPromocional : produto.precoPromocional;
  return typeof valor === "number" && valor > 0 ? valor : null;
}

/** O preço CHEIO, o que fica riscado quando há promoção. */
export function precoCheio(
  produto: Pick<Produto, "preco">,
  sabor?: Pick<SaborDoDoce, "preco"> | null
): number {
  return precoDoSabor(produto, sabor);
}

/**
 * O preço que o cliente paga de fato — é este que vai para o carrinho, para o
 * pedido e para o Mercado Pago.
 *
 * A promoção só vale se for MENOR que o preço cheio: um valor maior seria
 * erro de digitação, e cobrar a mais por causa disso é o pior desfecho
 * possível.
 */
export function precoAPagar(
  produto: ComPreco,
  sabor?: SaborComPreco | null
): number {
  const cheio = precoCheio(produto, sabor);
  const promo = promocaoDoSabor(produto, sabor);
  return promo != null && promo < cheio ? promo : cheio;
}

/** Está em promoção agora? */
export function emPromocao(
  produto: ComPreco,
  sabor?: SaborComPreco | null
): boolean {
  return precoAPagar(produto, sabor) < precoCheio(produto, sabor);
}

/** Quanto o cliente economiza nesta unidade. Zero quando não há promoção. */
export function economiaDaPromocao(
  produto: ComPreco,
  sabor?: SaborComPreco | null
): number {
  return Math.max(0, precoCheio(produto, sabor) - precoAPagar(produto, sabor));
}

/**
 * Quanto do carrinho o cupom pode abater.
 *
 * O item carrega `emPromocao` desde a hora em que entrou no carrinho, porque
 * é o preço daquele momento que está valendo ali. Quem confere de verdade é o
 * servidor, que refaz essa conta a partir do banco.
 */
export function subtotalQueAceitaCupom(itens: ItemPedido[]): number {
  return itens
    .filter((i) => !i.emPromocao)
    .reduce((soma, i) => soma + i.precoUnitario * i.quantidade, 0);
}

/** O carrinho inteiro está em promoção? Aí não há onde o cupom encostar. */
export function tudoEmPromocao(itens: ItemPedido[]): boolean {
  return itens.length > 0 && itens.every((i) => i.emPromocao);
}
