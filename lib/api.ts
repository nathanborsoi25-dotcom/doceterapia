import type {
  Cliente,
  ConfiguracaoFrete,
  Pedido,
  PedidoDoPainel,
  Produto,
  StatusPedido,
} from "./types";

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

/**
 * Envia a foto escolhida no aparelho e devolve o endereço público dela.
 * Vai como FormData (e não JSON) porque é arquivo.
 */
export async function enviarFotoProduto(arquivo: File): Promise<string> {
  const dados = new FormData();
  dados.append("foto", arquivo);
  const res = await fetch("/api/admin/foto", { method: "POST", body: dados });
  if (!res.ok) {
    throw new Error(await erroDoServidor(res, "Não foi possível enviar a foto."));
  }
  const { url } = (await res.json()) as { url: string };
  return url;
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

export async function getPedidos(): Promise<PedidoDoPainel[]> {
  return json<PedidoDoPainel[]>(await fetch("/api/pedidos", { cache: "no-store" }));
}

export async function atualizarStatusPedido(
  id: string,
  status: StatusPedido
): Promise<void> {
  await fetch(`/api/pedidos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

// ---- Cliente (cadastro, login, sessão) ----

/** Lê a mensagem de erro que o servidor mandou, pra mostrar na tela. */
async function erroDoServidor(res: Response, padrao: string): Promise<string> {
  const msg = await res
    .json()
    .then((c) => (c as { error?: string }).error)
    .catch(() => undefined);
  return msg || padrao;
}

export type DadosCadastro = {
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  senha: string;
  confirmarSenha: string;
  endereco: Cliente["endereco"];
};

export async function cadastrarCliente(dados: DadosCadastro): Promise<void> {
  const res = await fetch("/api/cliente/cadastro", POST_JSON(dados));
  if (!res.ok) throw new Error(await erroDoServidor(res, "Não foi possível cadastrar."));
}

export async function entrarCliente(cpf: string, senha: string): Promise<void> {
  const res = await fetch("/api/cliente/login", POST_JSON({ cpf, senha }));
  if (!res.ok) throw new Error(await erroDoServidor(res, "CPF ou senha incorretos."));
}

export async function sairCliente(): Promise<void> {
  await fetch("/api/cliente/logout", { method: "POST" });
}

/** Pede o código de redefinição; devolve o e-mail mascarado quando dá certo. */
export async function pedirCodigoSenha(cpf: string): Promise<{ email?: string }> {
  const res = await fetch("/api/cliente/recuperar", POST_JSON({ cpf }));
  if (!res.ok) {
    throw new Error(await erroDoServidor(res, "Não foi possível enviar o código."));
  }
  return res.json();
}

export async function redefinirSenha(dados: {
  cpf: string;
  codigo: string;
  senha: string;
  confirmarSenha: string;
}): Promise<void> {
  const res = await fetch("/api/cliente/redefinir", POST_JSON(dados));
  if (!res.ok) {
    throw new Error(await erroDoServidor(res, "Não foi possível redefinir a senha."));
  }
}

/** Cliente logado, ou null se a sessão não existir mais. */
export async function getClienteLogado(): Promise<(Cliente & { email?: string }) | null> {
  const res = await fetch("/api/cliente/eu", { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

// ---- Admin (login/logout) ----
export async function loginAdmin(password: string): Promise<boolean> {
  const res = await fetch("/api/admin/login", POST_JSON({ password }));
  return res.ok;
}

export async function logoutAdmin(): Promise<void> {
  await fetch("/api/admin/logout", { method: "POST" });
}
