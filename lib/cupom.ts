import type { cupons } from "./db/schema";

type Cupom = typeof cupons.$inferSelect;

/**
 * Para quem este cupom vale. Lista vazia = a loja toda.
 *
 * Existe porque o cupom pessoal já teve duas formas: primeiro `cliente_id`
 * (um dono só) e agora `clientes_ids` (vários). Em vez de espalhar essa
 * dúvida por cada tela e cada rota, a resposta fica num lugar só.
 */
export function donosDoCupom(
  cupom: Pick<Cupom, "clienteId" | "clientesIds">
): string[] {
  const lista = (cupom.clientesIds ?? []).filter(Boolean);
  if (lista.length > 0) return lista;
  return cupom.clienteId ? [cupom.clienteId] : [];
}

/** É cupom da loja toda? */
export function valeParaTodos(
  cupom: Pick<Cupom, "clienteId" | "clientesIds">
): boolean {
  return donosDoCupom(cupom).length === 0;
}

export type ResultadoCupom =
  | { valido: true; desconto: number; cupom: Cupom }
  | { valido: false; motivo: string };

/**
 * Decide se um cupom pode ser usado nesta compra e quanto ele abate.
 * Fica separado das rotas porque a mesma regra vale em dois lugares: quando
 * o cliente confere o cupom na tela e quando o servidor fecha o pedido.
 *
 * A `formaPagamento` só importa para o cupom de Pix. Quando ela não vem
 * (a tela ainda está só conferindo o código), o cupom de Pix é aceito e a
 * cobrança depois é travada em Pix — quem garante isso é `/api/pagamento`.
 */
export function avaliarCupom(
  cupom: Cupom | undefined,
  subtotal: number,
  clienteId: string,
  formaPagamento?: string,
  /**
   * Quanto do carrinho o cupom pode abater — o subtotal MENOS os doces que já
   * estão em promoção. Quando não vem, vale o carrinho inteiro (é o caso de
   * quem chama sem saber de promoção nenhuma).
   *
   * Dois descontos em cima do mesmo doce comem a margem inteira. O cupom foi
   * feito pra trazer gente de volta, não pra somar com a oferta — mas quem
   * leva um doce em promoção junto de outros não perde o cupom por isso: ele
   * simplesmente não encosta na parte que já está com desconto.
   */
  subtotalQueAceita?: number
): ResultadoCupom {
  if (!cupom || !cupom.ativo) {
    return { valido: false, motivo: "Cupom não encontrado." };
  }

  if (cupom.expiraEm && cupom.expiraEm.getTime() < Date.now()) {
    return { valido: false, motivo: "Este cupom já venceu." };
  }

  if (cupom.somentePix && formaPagamento && formaPagamento !== "pix") {
    return {
      valido: false,
      motivo: "Este cupom vale só para pagamento no Pix. Escolha Pix para usá-lo.",
    };
  }

  if (cupom.limiteUsos > 0 && cupom.usos >= cupom.limiteUsos) {
    return { valido: false, motivo: "Este cupom já atingiu o limite de usos." };
  }

  /*
   * Cupom pessoal: só quem foi escolhido consegue usar — pode ser uma
   * pessoa ou várias. A mensagem é a mesma de "não encontrado" pra ninguém
   * sair testando cupom dos outros e descobrir que ele existe.
   */
  const donos = donosDoCupom(cupom);
  if (donos.length > 0 && !donos.includes(clienteId)) {
    return { valido: false, motivo: "Cupom não encontrado." };
  }

  // O pedido mínimo olha o carrinho INTEIRO: é o quanto a pessoa está
  // gastando, tenha ou não doce em promoção no meio.
  if (subtotal < cupom.pedidoMinimo) {
    return {
      valido: false,
      motivo: `Este cupom vale em pedidos a partir de R$ ${cupom.pedidoMinimo.toFixed(2)}.`,
    };
  }

  const base = subtotalQueAceita ?? subtotal;

  if (base <= 0) {
    return {
      valido: false,
      motivo:
        "Os doces do seu carrinho já estão em promoção, e o cupom não vale junto com ela. O desconto do Pix continua valendo. 🍒",
    };
  }

  const bruto = cupom.tipo === "percentual" ? (base * cupom.valor) / 100 : cupom.valor;

  // O desconto nunca passa da parte que ele pode abater: o frete continua
  // sendo pago, o doce em promoção não é descontado de novo, e o pedido
  // jamais fica com valor negativo.
  const desconto = Math.min(Math.max(bruto, 0), base);

  return { valido: true, desconto: Math.round(desconto * 100) / 100, cupom };
}

/** Normaliza o código: sem espaços e em maiúsculas, pra não haver dúvida. */
export function normalizarCodigo(codigo: string): string {
  return (codigo ?? "").trim().toUpperCase().slice(0, 30);
}
