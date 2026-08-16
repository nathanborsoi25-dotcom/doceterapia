import type { StatusPedido } from "./types";

/**
 * O aviso de novidade no ícone da conta.
 *
 * A cliente fechava o pedido, saía do site e não tinha por que voltar: o
 * e-mail avisava a mudança, mas e-mail cai no spam, demora, ou simplesmente
 * não é lido. Pior no pedido que ficou **esperando pagamento** — ela desistiu
 * no meio, o pedido continua de pé, e nada no site lembra disso.
 *
 * Agora a barra de baixo mostra uma bolinha em cima de "Conta" enquanto
 * houver o que ver. O que conta como novidade:
 *
 * 1. **Pedido esperando pagamento** — este é insistente: continua marcado até
 *    ela pagar ou cancelar, porque é uma coisa que ela precisa FAZER, não
 *    apenas ler. Some sozinho não resolveria nada.
 * 2. **Situação que mudou desde a última visita** — "em preparo", "a caminho",
 *    "entregue", "cancelado". Esta some assim que ela abre Meus pedidos.
 */

/**
 * Avisa a barra de baixo que os avisos mudaram.
 *
 * A barra é montada uma vez e fica ali; sem este empurrão, abrir Meus pedidos
 * zeraria os avisos no banco e a bolinha continuaria acesa até a próxima
 * troca de tela.
 */
export const EVENTO_NOVIDADES = "dt:novidades";

/** Um aviso pendente, do jeito que a barra de baixo precisa saber. */
export type Novidades = {
  /** Quantos pedidos esperam pagamento. Aparecem sempre. */
  aguardandoPagamento: number;
  /** Quantos mudaram de situação e ela ainda não viu. */
  naoVistos: number;
  /** O total que a bolinha mostra. */
  total: number;
  /**
   * Quando a tela de promoções mudou pela última vez.
   *
   * Vem junto porque a barra já pergunta pelos pedidos a cada troca de tela —
   * uma segunda chamada só pra isso dobraria o tráfego de quem está passeando
   * pelo cardápio. Quem compara com a última visita é o navegador
   * (`lib/promocoes-vistas.ts`), já que a tela serve visitante sem conta.
   */
  promocoesEm?: string | null;
};

export const SEM_NOVIDADES: Novidades = {
  aguardandoPagamento: 0,
  naoVistos: 0,
  total: 0,
  promocoesEm: null,
};

/**
 * Esta mudança merece aviso?
 *
 * "Pago" não avisa: ela acabou de pagar, está olhando a tela de confirmação, e
 * uma bolinha ali seria eco do que ela já sabe. O que interessa é o que
 * acontece DEPOIS, quando ela já fechou o site.
 */
export function mudancaMereceAviso(status: StatusPedido): boolean {
  return (
    status === "em_preparo" ||
    status === "pronto" ||
    status === "a_caminho" ||
    status === "concluido" ||
    status === "cancelado"
  );
}

/** Conta os avisos de uma lista de pedidos (o servidor e a tela concordam). */
export function contarNovidades(
  pedidos: Array<{ status: string; statusVisto?: string | null }>
): Novidades {
  let aguardandoPagamento = 0;
  let naoVistos = 0;

  for (const p of pedidos) {
    const status = p.status as StatusPedido;

    if (status === "aguardando_pagamento") {
      aguardandoPagamento++;
      continue; // já está contado; não conta duas vezes o mesmo pedido
    }

    if (p.statusVisto !== status && mudancaMereceAviso(status)) {
      naoVistos++;
    }
  }

  return {
    aguardandoPagamento,
    naoVistos,
    total: aguardandoPagamento + naoVistos,
  };
}

/** A frase do aviso, pra tela não ter que montar texto na mão. */
export function contarNovidadesEscrito(n: Novidades): string {
  const partes: string[] = [];
  if (n.aguardandoPagamento > 0) {
    partes.push(
      n.aguardandoPagamento === 1
        ? "1 pedido esperando pagamento"
        : `${n.aguardandoPagamento} pedidos esperando pagamento`
    );
  }
  if (n.naoVistos > 0) {
    partes.push(
      n.naoVistos === 1 ? "1 pedido com novidade" : `${n.naoVistos} pedidos com novidade`
    );
  }
  return partes.join(" e ");
}
