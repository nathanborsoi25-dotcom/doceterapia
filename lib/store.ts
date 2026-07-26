"use client";

import type { Cliente, ItemPedido, Produto } from "./types";

/**
 * Dados que vivem SÓ no navegador de cada pessoa (por sessão):
 *  - o carrinho de compras
 *  - o cliente atualmente "logado" (o último cadastro feito neste navegador)
 *
 * Tudo o que precisa ser compartilhado e salvo de verdade (produtos,
 * clientes, pedidos, frete) agora fica no banco de dados, acessado via
 * lib/api.ts (rotas /api/*). Ver README.
 */

const KEYS = {
  cliente: "dt_cliente_atual",
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

// ---- Cliente logado (cadastro obrigatório) ----
export function getClienteAtual(): Cliente | null {
  return ler<Cliente | null>(KEYS.cliente, null);
}

export function salvarClienteAtual(cliente: Cliente) {
  salvar(KEYS.cliente, cliente);
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
