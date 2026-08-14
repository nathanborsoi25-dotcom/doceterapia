import { chaveDoItem } from "./sabores";
import { ehResgate } from "./resgate";
import { emPromocao, precoAPagar, precoCheio } from "./promocao";
import type { ItemPedido, Produto } from "./types";

/**
 * Confere os preços do carrinho contra o cardápio de agora.
 *
 * O item guarda o preço de quando entrou, e o carrinho fica no navegador por
 * dias. Se a Camily tirar um doce da promoção nesse meio-tempo, a tela
 * continuava mostrando os R$ 12,00 antigos — e o servidor, que refaz a conta
 * pelo banco, cobrava os R$ 16,00. A cliente via um valor e pagava outro.
 *
 * Quem tem razão é sempre o servidor. O problema nunca foi a cobrança: era a
 * TELA mentir. Então aqui a tela passa a contar a verdade — e, quando o preço
 * sobe, ela avisa em vez de trocar o número calado, que seria a mesma
 * desonestidade ao contrário.
 *
 * Vale para o carrinho e para o checkout, que precisam concordar entre si.
 */

export type MudancaNoCarrinho = {
  chave: string;
  nome: string;
  saborNome?: string;
  /** `preco` = o valor mudou · `sumiu` = o doce saiu do cardápio. */
  tipo: "preco" | "sumiu";
  de?: number;
  para?: number;
  /** O doce entrou em promoção agora. */
  virouOferta?: boolean;
  /** A promoção acabou. */
  acabouAOferta?: boolean;
};

export type CarrinhoConferido = {
  /** Os itens com os preços de agora — é isto que a tela deve mostrar. */
  itens: ItemPedido[];
  /** O que mudou desde que a pessoa montou o carrinho. Vazio = nada. */
  mudancas: MudancaNoCarrinho[];
  /** Algum preço SUBIU (ou um doce sumiu): merece aviso mais firme. */
  temMaNoticia: boolean;
};

/**
 * Devolve o carrinho com os preços de agora e a lista do que mudou.
 *
 * Não altera nada: quem decide gravar é a tela, porque só ela sabe se a
 * pessoa está olhando. `produtos` vazio (a busca falhou) devolve o carrinho
 * intacto — melhor mostrar o preço de ontem do que apagar o carrinho por
 * causa de uma falha de rede.
 */
export function conferirPrecos(
  itens: ItemPedido[],
  produtos: Produto[]
): CarrinhoConferido {
  if (produtos.length === 0) {
    return { itens, mudancas: [], temMaNoticia: false };
  }

  const porId = new Map(produtos.map((p) => [p.id, p]));
  const mudancas: MudancaNoCarrinho[] = [];
  const novos: ItemPedido[] = [];

  for (const item of itens) {
    // Prêmio trocado por pontos não mora no cardápio: ele custa zero, não tem
    // preço pra conferir, e procurá-lo entre os doces o faria ser tratado como
    // "saiu do cardápio" — sumindo do carrinho sozinho.
    if (ehResgate(item)) {
      novos.push(item);
      continue;
    }

    const chave = chaveDoItem(item.produtoId, item.saborId);
    const produto = porId.get(item.produtoId);
    const sabor = item.saborId
      ? (produto?.sabores ?? []).find((s) => s.id === item.saborId)
      : null;

    // Saiu do cardápio (ou o recheio saiu): o item não vai para a lista nova.
    // Deixá-lo ali só adiaria a recusa para a hora de pagar, quando a pessoa
    // já está com o cartão na mão.
    const sumiu =
      !produto ||
      !produto.ativo ||
      (item.saborId && (!sabor || !sabor.ativo));

    if (sumiu) {
      mudancas.push({
        chave,
        nome: item.nome,
        saborNome: item.saborNome,
        tipo: "sumiu",
      });
      continue;
    }

    const agora = precoAPagar(produto, sabor);
    const cheio = precoCheio(produto, sabor);
    const emOferta = emPromocao(produto, sabor);

    if (agora !== item.precoUnitario) {
      mudancas.push({
        chave,
        nome: item.nome,
        saborNome: item.saborNome,
        tipo: "preco",
        de: item.precoUnitario,
        para: agora,
        virouOferta: emOferta && !item.emPromocao,
        acabouAOferta: !emOferta && Boolean(item.emPromocao),
      });
    }

    novos.push({
      ...item,
      precoUnitario: agora,
      emPromocao: emOferta,
      precoCheio: emOferta ? cheio : undefined,
    });
  }

  return {
    itens: novos,
    mudancas,
    temMaNoticia: mudancas.some(
      (m) => m.tipo === "sumiu" || (m.para ?? 0) > (m.de ?? 0)
    ),
  };
}

/** A frase de cada mudança, no jeito da casa. */
export function contarMudanca(m: MudancaNoCarrinho): string {
  const nome = m.saborNome ? `${m.nome} (${m.saborNome})` : m.nome;

  if (m.tipo === "sumiu") {
    return `${nome} saiu do cardápio e foi tirado do seu carrinho.`;
  }
  if (m.virouOferta) {
    return `${nome} entrou em promoção — ficou mais barato pra você. 🍒`;
  }
  if (m.acabouAOferta) {
    return `A promoção de ${nome} acabou, e o preço voltou ao normal.`;
  }
  return (m.para ?? 0) > (m.de ?? 0)
    ? `O preço de ${nome} subiu desde que você o colocou no carrinho.`
    : `${nome} está mais barato do que quando você o colocou no carrinho.`;
}
