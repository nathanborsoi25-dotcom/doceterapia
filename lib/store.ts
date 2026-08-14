"use client";

import { chaveDoItem } from "./sabores";
import {
  itemDeResgate,
  jaEstaNoCarrinho,
  type RecompensaResgatavel,
} from "./resgate";
import { precoAPagar, precoCheio } from "./promocao";
import type { ItemPedido, Produto, SaborDoDoce } from "./types";

/**
 * O carrinho é a única coisa que ainda vive só no navegador — é rascunho de
 * compra, não faz falta em outro aparelho.
 *
 * Quem é o cliente NÃO fica mais aqui: agora vem da sessão de login no
 * servidor (lib/cliente-logado.ts), pra ninguém conseguir se passar por
 * outra pessoa mexendo no navegador.
 */

const KEYS = {
  carrinho: "dt_carrinho",
  enderecoVisitante: "dt_endereco",
};

function ler<T>(chave: string, padrao: T): T {
  if (typeof window === "undefined") return padrao;
  const raw = window.localStorage.getItem(chave);
  if (!raw) return padrao;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return padrao;
  }
}

function salvar<T>(chave: string, valor: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(chave, JSON.stringify(valor));
}

// ---- Carrinho ----
export function getCarrinho(): ItemPedido[] {
  return ler<ItemPedido[]>(KEYS.carrinho, []);
}

export function salvarCarrinho(itens: ItemPedido[]) {
  salvar(KEYS.carrinho, itens);
  avisarQueMudou();
  sincronizarComBanco(itens);
}

/**
 * Manda o carrinho pro servidor sem travar a tela: a pessoa continua
 * clicando normalmente, e se a rede falhar não acontece nada de ruim —
 * o carrinho do navegador continua valendo.
 */
function sincronizarComBanco(itens: ItemPedido[]) {
  if (typeof window === "undefined") return;
  fetch("/api/carrinho", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itens }),
    keepalive: true,
  }).catch(() => {
    // Sem drama: é só o espelho do carrinho no banco.
  });
}

/**
 * Aviso de que o carrinho mudou, pra quem está na tela reagir na hora — hoje
 * o contador do cabeçalho. O `storage` do navegador só avisa OUTRAS abas, e
 * quem acabou de adicionar o doce está justamente nesta.
 */
export const EVENTO_CARRINHO = "dt:carrinho";

function avisarQueMudou() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENTO_CARRINHO));
}

/** Quantos doces existem no carrinho, somando as quantidades. */
export function totalDeItens(): number {
  return getCarrinho().reduce((soma, i) => soma + i.quantidade, 0);
}

/**
 * Quantos deste doce já estão no carrinho. Com recheios, conta só o recheio
 * pedido — uma torta de Nutella e uma de ninho são itens diferentes.
 */
export function quantidadeNoCarrinho(
  produtoId: string,
  saborId?: string | null
): number {
  const chave = chaveDoItem(produtoId, saborId);
  const item = getCarrinho().find((i) => chaveDoItem(i.produtoId, i.saborId) === chave);
  return item?.quantidade ?? 0;
}

/**
 * Deixa o carrinho com EXATAMENTE esta quantidade do doce. Zero tira ele de lá.
 *
 * Quando o doce tem recheios, o sabor escolhido faz parte da identidade do
 * item: uma torta de Nutella e uma de ninho são duas linhas, não uma torta de
 * quantidade 2.
 *
 * É uma gravação só, mesmo para cinco unidades — cada `salvarCarrinho` avisa a
 * tela e manda o carrinho pro banco, então somar de um em um renderia cinco
 * idas à rede para uma única decisão da cliente.
 */
export function definirQuantidadeNoCarrinho(
  produto: Produto,
  sabor: SaborDoDoce | null | undefined,
  quantidade: number
) {
  const chave = chaveDoItem(produto.id, sabor?.id);
  const desejada = Math.max(0, Math.floor(quantidade));
  const itens = getCarrinho();
  const existente = itens.find((i) => chaveDoItem(i.produtoId, i.saborId) === chave);

  if (existente) {
    existente.quantidade = desejada;
  } else if (desejada > 0) {
    // O preço promocional entra aqui já — mas quem manda é o servidor, que
    // refaz esta conta a partir do banco na hora de fechar o pedido.
    const cheio = precoCheio(produto, sabor);
    const aPagar = precoAPagar(produto, sabor);
    itens.push({
      produtoId: produto.id,
      nome: produto.nome,
      precoUnitario: aPagar,
      quantidade: desejada,
      saborId: sabor?.id,
      saborNome: sabor?.nome,
      emPromocao: aPagar < cheio,
      precoCheio: aPagar < cheio ? cheio : undefined,
    });
  }

  salvarCarrinho(itens.filter((i) => i.quantidade > 0));
}

/** Soma esta quantidade ao que já houver no carrinho. */
export function adicionarAoCarrinho(
  produto: Produto,
  sabor?: SaborDoDoce | null,
  quantidade = 1
) {
  definirQuantidadeNoCarrinho(
    produto,
    sabor,
    quantidadeNoCarrinho(produto.id, sabor?.id) + quantidade
  );
}

/**
 * Põe um prêmio de pontos no carrinho, por R$ 0,00.
 *
 * Os pontos NÃO saem daqui: eles só são debitados quando o pagamento é
 * confirmado. Até lá o prêmio fica reservado no carrinho, e o servidor
 * confere o saldo de novo na hora de fechar o pedido — este é o navegador, e
 * o que ele diz nunca vale como verdade.
 */
export function resgatarParaOCarrinho(recompensa: RecompensaResgatavel) {
  const itens = getCarrinho();
  if (jaEstaNoCarrinho(itens, recompensa.id)) return;
  salvarCarrinho([...itens, itemDeResgate(recompensa)]);
}

/** Devolve o prêmio: tira do carrinho e libera os pontos de novo. */
export function tirarResgateDoCarrinho(recompensaId: string) {
  salvarCarrinho(getCarrinho().filter((i) => i.recompensaId !== recompensaId));
}

export function limparCarrinho() {
  salvar(KEYS.carrinho, []);
  sincronizarComBanco([]);
}

/**
 * Manda pro banco o carrinho que a pessoa montou ANTES de entrar.
 *
 * Enquanto ela era visitante, o servidor recusava (não havia sessão) e o
 * carrinho ficou só no navegador. Chamando isto logo depois do login, a
 * compra em andamento aparece pra Camily como carrinho abandonado se ela
 * desistir no meio — que é justamente quando vale a pena chamar no WhatsApp.
 */
export function sincronizarCarrinhoAposLogin() {
  const itens = getCarrinho();
  if (itens.length > 0) sincronizarComBanco(itens);
}

// ---- Endereço de quem ainda não tem conta ----

/**
 * Endereço que a visitante digita no checkout antes de criar conta, só pra
 * ver quanto fica o frete. Fica no navegador dela e nada mais: na hora de
 * fechar o pedido o servidor usa o endereço do CADASTRO, que é o único que
 * não dá pra forjar. Quando ela se cadastra, este endereço entra no
 * formulário já preenchido, pra não digitar duas vezes.
 */
export type EnderecoVisitante = {
  cep: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  complemento: string;
  lat?: number;
  lng?: number;
};

export const ENDERECO_VAZIO: EnderecoVisitante = {
  cep: "",
  rua: "",
  numero: "",
  bairro: "",
  cidade: "Arapongas",
  complemento: "",
};

export function getEnderecoVisitante(): EnderecoVisitante {
  return ler<EnderecoVisitante>(KEYS.enderecoVisitante, ENDERECO_VAZIO);
}

export function salvarEnderecoVisitante(endereco: EnderecoVisitante) {
  salvar(KEYS.enderecoVisitante, endereco);
}

export function limparEnderecoVisitante() {
  salvar(KEYS.enderecoVisitante, ENDERECO_VAZIO);
}
