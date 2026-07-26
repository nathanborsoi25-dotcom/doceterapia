"use client";

import type { Cliente, ConfiguracaoFrete, ItemPedido, Produto } from "./types";
import { configuracaoFretePadrao } from "./shipping";

/**
 * Camada de dados simples baseada em localStorage, só para o site já
 * nascer funcional e navegável no navegador. Antes de lançar de verdade
 * (com pagamentos reais e clientes de verdade), troque isso por um banco
 * de verdade — ex: Vercel Postgres, Supabase ou Neon — porque
 * localStorage vive só no navegador de cada pessoa, não é compartilhado
 * entre clientes nem sincroniza com o painel admin de outro dispositivo.
 * O README explica o passo a passo dessa troca.
 */

const KEYS = {
  cliente: "dt_cliente_atual",
  produtos: "dt_produtos",
  carrinho: "dt_carrinho",
  frete: "dt_config_frete",
};

const produtosIniciais: Produto[] = [
  {
    id: "p1",
    nome: "Brigadeiro Gourmet",
    descricao: "Brigadeiro cremoso feito com chocolate belga, enrolado na hora.",
    sabor: "Chocolate",
    preco: 4.5,
    fotoUrl: "",
    disponibilidade: "pronta_entrega",
    ativo: true,
  },
  {
    id: "p2",
    nome: "Torta de Cereja",
    descricao: "Torta cremosa de baunilha com cobertura de cereja, feita por encomenda.",
    sabor: "Cereja",
    preco: 65,
    fotoUrl: "",
    disponibilidade: "sob_encomenda",
    prazoDias: 3,
    ativo: true,
  },
];

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

// ---- Produtos (catálogo + admin) ----
export function getProdutos(): Produto[] {
  return ler<Produto[]>(KEYS.produtos, produtosIniciais);
}

export function salvarProdutos(produtos: Produto[]) {
  salvar(KEYS.produtos, produtos);
}

export function upsertProduto(produto: Produto) {
  const produtos = getProdutos();
  const idx = produtos.findIndex((p) => p.id === produto.id);
  if (idx >= 0) produtos[idx] = produto;
  else produtos.push(produto);
  salvarProdutos(produtos);
}

export function removerProduto(id: string) {
  salvarProdutos(getProdutos().filter((p) => p.id !== id));
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

// ---- Configuração de frete ----
export function getConfiguracaoFrete(): ConfiguracaoFrete {
  return ler<ConfiguracaoFrete>(KEYS.frete, configuracaoFretePadrao);
}

export function salvarConfiguracaoFrete(config: ConfiguracaoFrete) {
  salvar(KEYS.frete, config);
}

// ---- "Clientes" cadastrados (visão do admin) ----
// Em produção isso viria do banco (todo pedido/cadastro fica salvo lá).
// Aqui, para o protótipo, guardamos uma lista simples também em localStorage.
const KEY_LISTA_CLIENTES = "dt_lista_clientes";

export function registrarClienteNaLista(cliente: Cliente) {
  const lista = ler<Cliente[]>(KEY_LISTA_CLIENTES, []);
  const idx = lista.findIndex((c) => c.cpf === cliente.cpf);
  if (idx >= 0) lista[idx] = cliente;
  else lista.push(cliente);
  salvar(KEY_LISTA_CLIENTES, lista);
}

export function getListaClientes(): Cliente[] {
  return ler<Cliente[]>(KEY_LISTA_CLIENTES, []);
}
