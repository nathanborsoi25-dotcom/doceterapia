import type { cupons } from "./db/schema";

type Cupom = typeof cupons.$inferSelect;

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
  formaPagamento?: string
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

  // Cupom pessoal: só quem foi escolhido consegue usar. A mensagem é a mesma
  // de "não encontrado" pra ninguém sair testando cupom dos outros.
  if (cupom.clienteId && cupom.clienteId !== clienteId) {
    return { valido: false, motivo: "Cupom não encontrado." };
  }

  if (subtotal < cupom.pedidoMinimo) {
    return {
      valido: false,
      motivo: `Este cupom vale em pedidos a partir de R$ ${cupom.pedidoMinimo.toFixed(2)}.`,
    };
  }

  const bruto =
    cupom.tipo === "percentual" ? (subtotal * cupom.valor) / 100 : cupom.valor;

  // O desconto nunca passa do subtotal: o frete continua sendo pago, e o
  // pedido jamais fica com valor negativo.
  const desconto = Math.min(Math.max(bruto, 0), subtotal);

  return { valido: true, desconto: Math.round(desconto * 100) / 100, cupom };
}

/** Normaliza o código: sem espaços e em maiúsculas, pra não haver dúvida. */
export function normalizarCodigo(codigo: string): string {
  return (codigo ?? "").trim().toUpperCase().slice(0, 30);
}
