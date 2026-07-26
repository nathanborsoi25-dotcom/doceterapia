import type { Cliente, ConfiguracaoFrete, Pedido, Produto } from "./types";

/**
 * Funções que conversam com o backend (rotas /api/*), que por sua vez
 * lê/grava no banco Neon Postgres. Antes, esses dados viviam só no
 * localStorage do navegador (ver lib/store.ts) — agora ficam salvos de
 * verdade e são compartilhados entre todos os dispositivos.
 */

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`Erro na requisição (${res.status})`);
  return res.json() as Promise<T>;
}

const POST_JSON = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

// ---- Produtos ----
export async function getProdutos(): Promise<Produto[]> {
  return json<Produto[]>(await fetch("/api/produtos", { cache: "no-store" }));
}

export async function upsertProduto(produto: Produto): Promise<void> {
  await fetch("/api/produtos", POST_JSON(produto));
}

export async function removerProduto(id: string): Promise<void> {
  await fetch(`/api/produtos/${id}`, { method: "DELETE" });
}

// ---- Clientes ----
export async function registrarCliente(cliente: Cliente): Promise<void> {
  await fetch("/api/clientes", POST_JSON(cliente));
}

export async function getListaClientes(): Promise<Cliente[]> {
  return json<Cliente[]>(await fetch("/api/clientes", { cache: "no-store" }));
}

// ---- Frete ----
export async function getConfiguracaoFrete(): Promise<ConfiguracaoFrete> {
  return json<ConfiguracaoFrete>(await fetch("/api/frete", { cache: "no-store" }));
}

export async function salvarConfiguracaoFrete(
  config: ConfiguracaoFrete
): Promise<void> {
  await fetch("/api/frete", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
}

// ---- Pedidos ----
export type NovoPedido = Pick<
  Pedido,
  | "clienteId"
  | "itens"
  | "tipoEntrega"
  | "dataAgendada"
  | "enderecoEntrega"
  | "valorFrete"
  | "formaPagamento"
>;

export async function criarPedido(pedido: NovoPedido): Promise<{ id: string }> {
  return json<{ id: string }>(await fetch("/api/pedidos", POST_JSON(pedido)));
}

export async function getPedidos(): Promise<Pedido[]> {
  return json<Pedido[]>(await fetch("/api/pedidos", { cache: "no-store" }));
}

export async function atualizarStatusPedido(
  id: string,
  status: Pedido["status"]
): Promise<void> {
  await fetch(`/api/pedidos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}
