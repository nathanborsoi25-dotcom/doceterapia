import type { StatusPedido } from "./types";

/**
 * Como cada situação do pedido aparece para o CLIENTE. O painel da Camily tem
 * os nomes dela ("Pago", "Em preparo"); aqui a conversa é outra — a pessoa
 * quer saber o que está acontecendo com os doces dela.
 */
export const SITUACAO_PARA_CLIENTE: Record<
  StatusPedido,
  { rotulo: string; explicacao: string; cor: string }
> = {
  aguardando_pagamento: {
    rotulo: "Aguardando pagamento",
    explicacao: "Assim que o pagamento for confirmado, a Camily começa a preparar.",
    cor: "bg-amber-100 text-amber-800",
  },
  pago: {
    rotulo: "Pagamento confirmado",
    explicacao: "Seu pedido está na fila da Camily.",
    cor: "bg-green-100 text-green-800",
  },
  em_preparo: {
    rotulo: "Em preparo",
    explicacao: "Seus doces estão sendo feitos agorinha.",
    cor: "bg-blush text-cherryDark",
  },
  a_caminho: {
    rotulo: "A caminho",
    explicacao: "Seu pedido saiu para entrega (ou já está pronto para retirada).",
    cor: "bg-blush text-cherryDark",
  },
  concluido: {
    rotulo: "Entregue",
    explicacao: "Esperamos que você tenha adorado! Conta pra gente o que achou.",
    cor: "bg-green-100 text-green-800",
  },
  cancelado: {
    rotulo: "Cancelado",
    explicacao: "Este pedido foi cancelado.",
    cor: "bg-ink/10 text-ink/60",
  },
};

/** Texto do reembolso na tela do cliente. */
export function textoDoReembolso(status: string | null): string | null {
  switch (status) {
    case "concluido":
      return "Devolução do valor solicitada ao Mercado Pago. No Pix costuma cair em minutos; no cartão pode aparecer só na próxima fatura.";
    case "falhou":
      return "A devolução automática não saiu. A Camily foi avisada e resolve isso com você pelo WhatsApp.";
    case "nao_precisa":
      return "Não havia pagamento concluído, então não há valor a devolver.";
    default:
      return null;
  }
}
