import type { ItemPedido } from "./types";

/**
 * Prêmios trocados por pontos, dentro do carrinho.
 *
 * Antes, resgatar era "fale com a Camily no WhatsApp": a cliente juntava
 * pontos, via o prêmio na tela e não tinha como pegá-lo sozinha. O prêmio
 * agora entra no carrinho como um item de **R$ 0,00** e viaja com o pedido
 * como qualquer doce — se for entrega, ela paga só o frete.
 *
 * ⚠️ **Os pontos só são debitados quando o pagamento é confirmado**, no
 * webhook — igual aos pontos que ela ganha. Debitar no clique do resgate
 * cobraria por um pedido que talvez nunca fosse pago, e obrigaria a devolver
 * em todo carrinho abandonado. Até lá o prêmio fica no carrinho, reservado
 * mas não cobrado, e o servidor confere o saldo de novo na hora de fechar.
 */

/** O `produtoId` de um prêmio, que nunca colide com o de um doce. */
export const PREFIXO_RESGATE = "resgate:";

export type RecompensaResgatavel = {
  id: string;
  nome: string;
  descricao?: string;
  pontos: number;
};

export function ehResgate(item: Pick<ItemPedido, "recompensaId">): boolean {
  return Boolean(item.recompensaId);
}

/** Monta o item de carrinho de um prêmio. Sempre quantidade 1 e preço zero. */
export function itemDeResgate(recompensa: RecompensaResgatavel): ItemPedido {
  return {
    produtoId: `${PREFIXO_RESGATE}${recompensa.id}`,
    nome: recompensa.nome,
    precoUnitario: 0,
    quantidade: 1,
    recompensaId: recompensa.id,
    pontosGastos: recompensa.pontos,
  };
}

/** Quantos pontos os prêmios do carrinho custam somados. */
export function pontosDoCarrinho(itens: ItemPedido[]): number {
  return itens.reduce(
    (soma, i) => soma + (ehResgate(i) ? (i.pontosGastos ?? 0) * i.quantidade : 0),
    0
  );
}

/** Só os prêmios. */
export function resgatesDoCarrinho(itens: ItemPedido[]): ItemPedido[] {
  return itens.filter(ehResgate);
}

/** Este prêmio já está no carrinho? Não faz sentido levar dois iguais. */
export function jaEstaNoCarrinho(itens: ItemPedido[], recompensaId: string): boolean {
  return itens.some((i) => i.recompensaId === recompensaId);
}

/**
 * Dá pra resgatar este prêmio agora?
 *
 * O saldo precisa cobrir o que já está no carrinho MAIS o novo — senão a
 * pessoa enche o carrinho de prêmios e só descobre que não dá na hora de
 * pagar, que é o pior momento possível.
 */
export function podeResgatar(
  saldo: number,
  itensNoCarrinho: ItemPedido[],
  recompensa: RecompensaResgatavel
): { pode: boolean; motivo?: string; falta?: number } {
  if (jaEstaNoCarrinho(itensNoCarrinho, recompensa.id)) {
    return { pode: false, motivo: "Esse prêmio já está no seu carrinho." };
  }

  const comprometidos = pontosDoCarrinho(itensNoCarrinho);
  const disponivel = saldo - comprometidos;

  if (disponivel < recompensa.pontos) {
    const falta = recompensa.pontos - disponivel;
    return {
      pode: false,
      falta,
      motivo:
        comprometidos > 0
          ? `Faltam ${falta} pontos — os outros prêmios do seu carrinho já usam ${comprometidos}.`
          : `Faltam ${falta} pontos pra esse prêmio.`,
    };
  }

  return { pode: true };
}
