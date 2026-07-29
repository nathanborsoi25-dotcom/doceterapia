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

// ---- Geocodificação (endereço → coordenadas) ----
export async function geocodificarEndereco(endereco: {
  rua?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  cep?: string;
}): Promise<{ lat: number | null; lng: number | null }> {
  try {
    const res = await fetch("/api/geocodificar", POST_JSON(endereco));
    if (!res.ok) return { lat: null, lng: null };
    return res.json();
  } catch {
    return { lat: null, lng: null };
  }
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
): Promise<{ ok: boolean; origem?: ConfiguracaoFrete["origem"] }> {
  const res = await fetch("/api/frete", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) return { ok: false };
  return res.json();
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

/**
 * Cria o pedido e inicia o pagamento no Mercado Pago. Retorna a URL do
 * checkout do MP (`url`) para onde o cliente deve ser redirecionado.
 */
export async function iniciarPagamento(
  pedido: NovoPedido
): Promise<{ pedidoId: string; url: string | null }> {
  const res = await fetch("/api/pagamento", POST_JSON(pedido));
  if (!res.ok) {
    // O servidor manda uma mensagem amigável em `error` (ex: endereço fora
    // da área de entrega); repassa ela pra UI mostrar.
    const msg = await res
      .json()
      .then((c) => (c as { error?: string }).error)
      .catch(() => undefined);
    throw new Error(msg || `Erro no pagamento (${res.status})`);
  }
  return res.json();
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

// ---- Admin (login/logout) ----
export async function loginAdmin(password: string): Promise<boolean> {
  const res = await fetch("/api/admin/login", POST_JSON({ password }));
  return res.ok;
}

export async function logoutAdmin(): Promise<void> {
  await fetch("/api/admin/logout", { method: "POST" });
}
