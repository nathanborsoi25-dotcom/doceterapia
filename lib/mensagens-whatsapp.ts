import type { StatusPedido } from "./types";

/**
 * Mensagens que a Camily manda pro cliente no WhatsApp. Ficam aqui, prontas,
 * pra ela não ter que escrever tudo de novo a cada pedido — é só clicar,
 * conferir e enviar.
 */

type Contexto = {
  nome: string | null;
  tipoEntrega: string;
  linkRastreio?: string | null;
};

function primeiroNome(nome: string | null): string {
  return (nome ?? "").trim().split(" ")[0] || "tudo bem";
}

/**
 * Texto do aviso para cada situação, ou null quando não faz sentido avisar.
 * O botão que usa isto também muda a situação do pedido, pra Camily não
 * precisar fazer duas coisas.
 */
export function mensagemDeStatus(
  status: StatusPedido,
  ctx: Contexto
): string | null {
  const nome = primeiroNome(ctx.nome);
  const ehEntrega = ctx.tipoEntrega === "entrega";

  switch (status) {
    case "em_preparo":
      return `Oi, ${nome}! Aqui é a Camily, da Doceterapia 🍒 Já comecei a preparar seus doces. Aviso assim que ficarem prontos!`;

    case "a_caminho":
      return ehEntrega
        ? `Oi, ${nome}! Seus doces já saíram para entrega 🛵${ctx.linkRastreio ? ` Você pode acompanhar por aqui: ${ctx.linkRastreio}` : ""} Qualquer coisa é só me chamar!`
        : `Oi, ${nome}! Seus doces estão prontinhos esperando por você 🍒 Pode vir buscar no horário que combinamos!`;

    case "concluido":
      return `Oi, ${nome}! Espero que você tenha amado os doces 💗 Se puder me contar o que achou, fico muito feliz. Obrigada pela confiança!`;

    case "cancelado":
      return `Oi, ${nome}! Seu pedido na Doceterapia foi cancelado. Se o pagamento já tinha sido feito, o reembolso é processado automaticamente — no Pix costuma voltar rápido e no cartão pode aparecer só na próxima fatura. Qualquer dúvida, me chama!`;

    case "pago":
      return `Oi, ${nome}! Recebi seu pagamento, muito obrigada 🍒 Seu pedido já está na fila e eu aviso quando começar a preparar.`;

    default:
      return null;
  }
}

/** Mensagem para resgatar quem montou o carrinho e não finalizou. */
export function mensagemCarrinhoAbandonado(nome: string | null): string {
  return `Oi, ${primeiroNome(nome)}! Aqui é a Camily, da Doceterapia 🍒 Vi que você montou um carrinho no site e não chegou a finalizar. Posso te ajudar com alguma coisa? Se preferir, faço seu pedido por aqui mesmo!`;
}
