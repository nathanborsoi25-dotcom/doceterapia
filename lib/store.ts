"use client";

import type { ItemPedido, Produto } from "./types";

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
}

export function adicionarAoCarrinho(produto: Produto) {
  const itens = getCarrinho();
  const existente = itens.find((i) => i.produtoId === produto.id);
  if (existente) {
    existente.quantidade += 1;
  } else {
    itens.push({
      produtoId: produto.id,
      nome: produto.nome,
      precoUnitario: produto.preco,
      quantidade: 1,
    });
  }
  salvarCarrinho(itens);
}

export function limparCarrinho() {
  salvar(KEYS.carrinho, []);
}
