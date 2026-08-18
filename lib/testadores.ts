import { normalizarEmail } from "./validacoes";

/**
 * Contas que podem fechar pedido com a loja FECHADA.
 *
 * Existe por um motivo prático: o pagamento só se testa de verdade pagando, e
 * o dono do site quase sempre vai mexer nisso de madrugada — quando a regra de
 * horário (9h às 22h) recusaria a compra dele com 409, e o teste morreria
 * antes de chegar no Mercado Pago.
 *
 * ⚠️ Isto NÃO abre a loja para ninguém mais: a recusa continua valendo para
 * toda cliente, e é ela que impede pedido de madrugada que a Camily só veria
 * no dia seguinte. É uma exceção nominal, e por isso mora aqui — visível, com
 * nome e sobrenome, e não escondida numa variável de ambiente qualquer.
 */
const TESTADORES = ["nathanborsoi@hotmail.com", "nathanborsoi25@gmail.com"];

/** Esta pessoa pode comprar fora do horário, para testar? */
export function podeComprarComLojaFechada(email: string | null | undefined): boolean {
  if (!email) return false;
  return TESTADORES.includes(normalizarEmail(email));
}
