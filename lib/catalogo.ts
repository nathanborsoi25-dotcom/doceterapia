import { saboresVisiveis, saborEsgotado, faixaDePreco } from "./sabores";
import type { Produto } from "./types";

/**
 * Regras de organização do cardápio e da tela de produtos: categoria, busca e
 * situação de estoque. Ficam aqui porque o painel e o cardápio precisam
 * concordar — o que a Camily chama de "esgotado" tem que ser o mesmo que a
 * cliente vê esgotado.
 */

/** Nome usado quando o doce não tem categoria. */
export const SEM_CATEGORIA = "Outros doces";

export function categoriaDoProduto(produto: Pick<Produto, "categoria">): string {
  return (produto.categoria ?? "").trim() || SEM_CATEGORIA;
}

/**
 * Categorias que aparecem nos doces, na ordem em que devem ser mostradas.
 *
 * `ordemPreferida` é a lista que a Camily montou no painel — quem está nela
 * vem primeiro, na ordem dela. O que sobrar (categoria antiga de um doce que
 * ela não recriou) entra em ordem alfabética, e "Outros doces" fecha a fila:
 * é o resto, não uma categoria de verdade.
 */
export function categoriasDe(
  produtos: Pick<Produto, "categoria">[],
  ordemPreferida: string[] = []
): string[] {
  const nomes = new Set(produtos.map(categoriaDoProduto));

  const primeiro = ordemPreferida.filter((c) => nomes.has(c));
  const resto = [...nomes]
    .filter((c) => c !== SEM_CATEGORIA && !primeiro.includes(c))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  const lista = [...primeiro, ...resto];
  if (nomes.has(SEM_CATEGORIA)) lista.push(SEM_CATEGORIA);
  return lista;
}

/** Agrupa os doces por categoria, respeitando a ordem acima. */
export function agruparPorCategoria<T extends Pick<Produto, "categoria">>(
  produtos: T[],
  ordemPreferida: string[] = []
): Array<{ categoria: string; doces: T[] }> {
  return categoriasDe(produtos, ordemPreferida).map((categoria) => ({
    categoria,
    doces: produtos.filter((p) => categoriaDoProduto(p) === categoria),
  }));
}

export type SituacaoEstoque = "esgotado" | "disponivel" | "sem_controle";

/**
 * Como está o estoque do doce. Com recheios, olha os recheios: só está
 * esgotado quando TODOS acabaram, porque enquanto sobrar um recheio o doce
 * continua vendendo.
 */
export function situacaoDoEstoque(produto: Produto): SituacaoEstoque {
  const sabores = saboresVisiveis(produto);

  if (sabores.length > 0) {
    if (sabores.every(saborEsgotado)) return "esgotado";
    const algumControlado = sabores.some((s) => s.estoque != null);
    return algumControlado ? "disponivel" : "sem_controle";
  }

  if (produto.estoque == null) return "sem_controle";
  return produto.estoque === 0 ? "esgotado" : "disponivel";
}

/** Texto curto do estoque, pro painel mostrar sem abrir o doce. */
export function resumoDeEstoqueTexto(produto: Produto): string {
  const sabores = saboresVisiveis(produto);

  if (sabores.length > 0) {
    const comControle = sabores.filter((s) => s.estoque != null);
    if (comControle.length === 0) return "sempre disponível";
    const total = comControle.reduce((soma, s) => soma + (s.estoque ?? 0), 0);
    const acabaram = sabores.filter(saborEsgotado).length;
    if (total === 0) return "esgotado";
    return acabaram > 0
      ? `${total} un. · ${acabaram} recheio(s) esgotado(s)`
      : `${total} un. nos recheios`;
  }

  if (produto.estoque == null) return "sempre disponível";
  if (produto.estoque === 0) return "esgotado";
  return `${produto.estoque} ${produto.estoque === 1 ? "unidade" : "unidades"}`;
}

/** O preço que o painel mostra na linha compacta. */
export function resumoDePreco(produto: Produto): string {
  const { menor, variam } = faixaDePreco(produto);
  const valor = `R$ ${menor.toFixed(2).replace(".", ",")}`;
  return variam ? `a partir de ${valor}` : valor;
}

function semAcento(texto: string): string {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Busca do painel: procura no nome, na categoria, no sabor, na descrição e
 * nos nomes dos recheios. Ignora acento e maiúscula, porque ninguém digita
 * "maracujá" com acento quando está com pressa.
 */
export function combinaComBusca(produto: Produto, busca: string): boolean {
  const termo = semAcento(busca).trim();
  if (!termo) return true;

  const campos = [
    produto.nome,
    produto.categoria ?? "",
    produto.sabor ?? "",
    produto.descricao ?? "",
    ...(produto.sabores ?? []).map((s) => s.nome),
  ];

  const alvo = semAcento(campos.join(" "));
  // Cada palavra digitada precisa aparecer em algum lugar — assim
  // "torta nutella" acha a torta com recheio de Nutella.
  return termo.split(/\s+/).every((palavra) => alvo.includes(palavra));
}
