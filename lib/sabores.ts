import type { Produto, SaborDoDoce } from "./types";

/**
 * Regras dos recheios, num lugar só.
 *
 * Duas coisas se repetiriam por toda tela se não morassem aqui: "quanto custa
 * este sabor?" (o dele, ou o do doce quando está em branco) e "dá pra vender?"
 * (o estoque é dele, não do doce).
 */

/** Só os sabores que a cliente pode ver, na ordem que a Camily definiu. */
export function saboresVisiveis(produto: Pick<Produto, "sabores">): SaborDoDoce[] {
  return (produto.sabores ?? [])
    .filter((s) => s.ativo)
    .slice()
    .sort((a, b) => a.ordem - b.ordem);
}

export function temSabores(produto: Pick<Produto, "sabores">): boolean {
  return saboresVisiveis(produto).length > 0;
}

/** O preço que vale: o do sabor, ou o do doce quando o sabor não tem um. */
export function precoDoSabor(
  produto: Pick<Produto, "preco">,
  sabor?: Pick<SaborDoDoce, "preco"> | null
): number {
  return sabor?.preco != null ? sabor.preco : produto.preco;
}

/**
 * Quantas unidades existem para vender.
 *
 * Quando o doce tem sabores, quem manda é o estoque do sabor — o do doce
 * deixa de valer, senão a conta seria feita duas vezes na mesma venda.
 * `null` significa "sem controle".
 */
export function estoqueDoSabor(
  produto: Pick<Produto, "estoque" | "sabores">,
  sabor?: Pick<SaborDoDoce, "estoque"> | null
): number | null {
  if (sabor) return sabor.estoque ?? null;
  return produto.estoque ?? null;
}

/**
 * Pronta entrega ou sob encomenda: o recheio manda quando disse alguma coisa;
 * senão vale o que está no doce.
 */
export function disponibilidadeDoSabor(
  produto: Pick<Produto, "disponibilidade">,
  sabor?: Pick<SaborDoDoce, "disponibilidade"> | null
): Produto["disponibilidade"] {
  return sabor?.disponibilidade ?? produto.disponibilidade;
}

/** Dias de preparo que valem para a escolha atual (0 = pronta entrega). */
export function prazoDoSabor(
  produto: Pick<Produto, "disponibilidade" | "prazoDias">,
  sabor?: Pick<SaborDoDoce, "disponibilidade" | "prazoDias"> | null
): number {
  if (disponibilidadeDoSabor(produto, sabor) !== "sob_encomenda") return 0;
  const dias = sabor?.disponibilidade ? sabor.prazoDias : produto.prazoDias;
  return Math.max(0, Math.floor(Number(dias) || 0));
}

/** Sabor esgotado não pode ser escolhido, mas continua visível (riscado). */
export function saborEsgotado(sabor: Pick<SaborDoDoce, "estoque">): boolean {
  return sabor.estoque === 0;
}

/**
 * O doce inteiro está fora do ar? Só quando TODOS os sabores esgotaram — se
 * sobrou um recheio, o doce continua à venda.
 */
export function doceEsgotado(produto: Pick<Produto, "estoque" | "sabores">): boolean {
  const sabores = saboresVisiveis(produto);
  if (sabores.length === 0) return produto.estoque === 0;
  return sabores.every(saborEsgotado);
}

/**
 * A partir de qual preço o doce sai, para o card mostrar quando os sabores
 * custam valores diferentes ("a partir de R$ 22,00").
 */
export function faixaDePreco(produto: Pick<Produto, "preco" | "sabores">): {
  menor: number;
  variam: boolean;
} {
  const sabores = saboresVisiveis(produto);
  if (sabores.length === 0) return { menor: produto.preco, variam: false };

  const precos = sabores.map((s) => precoDoSabor(produto, s));
  const menor = Math.min(...precos);
  const maior = Math.max(...precos);
  return { menor, variam: menor !== maior };
}

/** Identidade do item no carrinho: o mesmo doce em recheios diferentes é outro item. */
export function chaveDoItem(produtoId: string, saborId?: string | null): string {
  return saborId ? `${produtoId}::${saborId}` : produtoId;
}
