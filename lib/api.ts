import type {
  Avaliacao,
  Cliente,
  ConfiguracaoFrete,
  Pedido,
  PedidoDoCliente,
  PedidoDoPainel,
  Produto,
  StatusPedido,
  StoryEnviado,
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

// ---- Categorias do cardápio ----
export type CategoriaDoPainel = {
  id: string;
  nome: string;
  ordem: number;
  /** Quantos doces estão nela — o painel avisa antes de remover. */
  doces: number;
};

/** Leitura pública: o cardápio usa a ordem definida pela Camily. */
export async function getCategorias(): Promise<CategoriaDoPainel[]> {
  return json<CategoriaDoPainel[]>(
    await fetch("/api/categorias", { cache: "no-store" })
  );
}

export async function criarCategoria(nome: string): Promise<void> {
  const res = await fetch("/api/categorias", POST_JSON({ nome }));
  if (!res.ok) {
    throw new Error(await erroDoServidor(res, "Não foi possível criar a categoria."));
  }
}

export async function renomearCategoria(id: string, nome: string): Promise<void> {
  const res = await fetch("/api/categorias", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, nome }),
  });
  if (!res.ok) {
    throw new Error(await erroDoServidor(res, "Não foi possível renomear."));
  }
}

export async function reordenarCategorias(
  ordem: Array<{ id: string; ordem: number }>
): Promise<void> {
  await fetch("/api/categorias", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ordem }),
  });
}

export async function removerCategoria(id: string): Promise<void> {
  await fetch(`/api/categorias?id=${encodeURIComponent(id)}`, { method: "DELETE" });
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

// ---- CEP (preenche o endereço sozinho) ----
export type EnderecoDoCep = {
  rua: string;
  bairro: string;
  cidade: string;
  uf: string;
};

/** Busca o endereço do CEP. Devolve null quando não achou — sem quebrar a tela. */
export async function buscarEnderecoPorCep(
  cep: string
): Promise<EnderecoDoCep | null> {
  try {
    const res = await fetch(`/api/cep?cep=${encodeURIComponent(cep)}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
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

export type CarrinhoAbandonado = {
  clienteId: string;
  itens: Pedido["itens"];
  total: number;
  atualizadoEm: string;
  clienteNome: string | null;
  clienteTelefone: string | null;
};

/** Carrinhos montados que não viraram pedido. */
export async function getCarrinhosAbandonados(): Promise<CarrinhoAbandonado[]> {
  return json<CarrinhoAbandonado[]>(
    await fetch("/api/carrinhos-abandonados", { cache: "no-store" })
  );
}

export async function atualizarPedido(
  id: string,
  mudancas: { status?: StatusPedido; linkRastreio?: string; motivo?: string }
): Promise<void> {
  const res = await fetch(`/api/pedidos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mudancas),
  });
  if (!res.ok) {
    throw new Error(await erroDoServidor(res, "Não foi possível atualizar o pedido."));
  }
}

/** Nova tentativa de estorno, quando o Mercado Pago recusou na primeira. */
export async function tentarEstorno(id: string): Promise<void> {
  const res = await fetch(`/api/pedidos/${id}/estorno`, { method: "POST" });
  if (!res.ok) {
    throw new Error(await erroDoServidor(res, "Não foi possível estornar."));
  }
}

// ---- Minha conta (o cliente olhando as próprias compras) ----

/** Pedidos de quem está logado, do mais novo pro mais antigo. */
export async function getMeusPedidos(): Promise<PedidoDoCliente[]> {
  return json<PedidoDoCliente[]>(
    await fetch("/api/cliente/pedidos", { cache: "no-store" })
  );
}

export type ResultadoCancelamento = {
  reembolso: "nao_precisa" | "concluido" | "falhou";
  valorReembolsado: number;
};

export async function cancelarMeuPedido(
  id: string,
  motivo: string
): Promise<ResultadoCancelamento> {
  const res = await fetch(`/api/cliente/pedidos/${id}/cancelar`, POST_JSON({ motivo }));
  if (!res.ok) {
    throw new Error(await erroDoServidor(res, "Não foi possível cancelar o pedido."));
  }
  return res.json();
}

export type MinhaConta = {
  saldoPontos: number;
  extrato: Array<{
    id: string;
    quantidade: number;
    motivo: string;
    descricao: string;
    criadoEm: string;
  }>;
  cupons: Array<{
    codigo: string;
    descricao: string;
    tipo: string;
    valor: number;
    pedidoMinimo: number;
    expiraEm: string | null;
    exclusivo: boolean;
  }>;
  recompensas: Array<{ id: string; nome: string; descricao: string; pontos: number }>;
};

/** Pontos, extrato, cupons disponíveis e prêmios — tudo o que a conta mostra. */
export async function getMinhaConta(): Promise<MinhaConta> {
  return json<MinhaConta>(await fetch("/api/cliente/conta", { cache: "no-store" }));
}

/** Salva as alterações que o cliente fez nos próprios dados. */
export async function salvarMeusDados(dados: {
  nome: string;
  email: string;
  telefone: string;
  endereco: Cliente["endereco"];
}): Promise<void> {
  const res = await fetch("/api/cliente/eu", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
  if (!res.ok) {
    throw new Error(await erroDoServidor(res, "Não foi possível salvar seus dados."));
  }
}

// ---- Avaliações ----
export async function getAvaliacoesDoProduto(produtoId: string): Promise<Avaliacao[]> {
  return json<Avaliacao[]>(
    await fetch(`/api/avaliacoes?produtoId=${encodeURIComponent(produtoId)}`, {
      cache: "no-store",
    })
  );
}

export async function avaliarDoce(dados: {
  pedidoId: string;
  produtoId: string;
  nota: number;
  comentario: string;
}): Promise<{ pontosGanhos: number }> {
  const res = await fetch("/api/avaliacoes", POST_JSON(dados));
  if (!res.ok) {
    throw new Error(await erroDoServidor(res, "Não foi possível enviar sua avaliação."));
  }
  return res.json();
}

// ---- Stories (a cliente posta, a Camily aprova) ----

/** Os stories que a própria cliente já enviou. */
export async function getMeusStories(): Promise<StoryEnviado[]> {
  return json<StoryEnviado[]>(
    await fetch("/api/cliente/stories", { cache: "no-store" })
  );
}

/** Manda o print do story. Vai como FormData porque é arquivo. */
export async function enviarStory(dados: {
  pedidoId: string;
  arroba: string;
  imagem: File;
}): Promise<void> {
  const form = new FormData();
  form.append("pedidoId", dados.pedidoId);
  form.append("arroba", dados.arroba);
  form.append("imagem", dados.imagem);

  const res = await fetch("/api/cliente/stories", { method: "POST", body: form });
  if (!res.ok) {
    throw new Error(await erroDoServidor(res, "Não foi possível enviar seu story."));
  }
}

/** Painel: todos os stories enviados, com o print. */
export async function getStoriesDoPainel(): Promise<StoryEnviado[]> {
  return json<StoryEnviado[]>(
    await fetch("/api/admin/stories", { cache: "no-store" })
  );
}

export async function decidirStory(
  id: string,
  aprovar: boolean
): Promise<{ pontos: number }> {
  const res = await fetch("/api/admin/stories", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, aprovar }),
  });
  if (!res.ok) {
    throw new Error(await erroDoServidor(res, "Não foi possível decidir agora."));
  }
  return res.json();
}

/** Painel: todas as avaliações, inclusive as escondidas. */
export async function getTodasAvaliacoes(): Promise<Avaliacao[]> {
  return json<Avaliacao[]>(
    await fetch("/api/admin/avaliacoes", { cache: "no-store" })
  );
}

export async function mostrarOuEsconderAvaliacao(
  id: string,
  visivel: boolean
): Promise<void> {
  await fetch("/api/admin/avaliacoes", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, visivel }),
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
