import { eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import { produtos, sabores } from "./db/schema";
import type { ItemPedido } from "./types";

/**
 * Controle de estoque dos doces.
 *
 * Regra geral: `estoque` nulo quer dizer "a Camily não controla este doce" —
 * ele nunca esgota. Só número entra na conta.
 *
 * Quando o estoque baixa: no PAGAMENTO CONFIRMADO, não na criação do pedido.
 * Se descontasse ao criar, carrinho abandonado no meio do checkout seguraria
 * doce que ninguém comprou. E volta pro estoque quando o pedido é cancelado.
 */

/** Doce em falta, do jeito que a mensagem de erro precisa mostrar. */
export type FaltaDeEstoque = { nome: string; disponivel: number };

type ProdutoComEstoque = { id: string; nome: string; estoque: number | null };
type SaborComEstoque = { id: string; nome: string; estoque: number | null };

/**
 * Confere se dá pra vender tudo que está no carrinho. Devolve a lista do que
 * faltou (vazia quando está tudo certo).
 *
 * Quando o item tem recheio, quem vale é o estoque DELE — o do doce não entra
 * na conta, senão a mesma venda seria descontada duas vezes.
 */
export function conferirEstoque(
  itens: Array<{ produtoId: string; quantidade: number; saborId?: string }>,
  porId: Map<string, ProdutoComEstoque>,
  saborPorId?: Map<string, SaborComEstoque>
): FaltaDeEstoque[] {
  const faltas: FaltaDeEstoque[] = [];

  for (const item of itens) {
    const produto = porId.get(item.produtoId);
    if (!produto) continue;

    const sabor = item.saborId ? saborPorId?.get(item.saborId) : undefined;
    const disponivel = sabor ? sabor.estoque : produto.estoque;
    if (disponivel == null) continue; // sem controle

    if (disponivel < item.quantidade) {
      faltas.push({
        nome: sabor ? `${produto.nome} (${sabor.nome})` : produto.nome,
        disponivel,
      });
    }
  }
  return faltas;
}

/** Mensagem pronta pro cliente entender o que aconteceu. */
export function mensagemDeFalta(faltas: FaltaDeEstoque[]): string {
  const partes = faltas.map((f) =>
    f.disponivel === 0
      ? `${f.nome} esgotou`
      : `${f.nome} só tem ${f.disponivel} ${f.disponivel === 1 ? "unidade" : "unidades"}`
  );
  return `Enquanto você finalizava, o estoque mudou: ${partes.join(" e ")}. Ajuste o carrinho e tente de novo.`;
}

/**
 * Baixa o estoque dos itens de um pedido pago.
 *
 * O `greatest(..., 0)` existe porque duas compras do último doce podem cair
 * quase juntas: nesse caso o estoque para em zero em vez de ficar negativo, e
 * a Camily resolve com a cliente pelo WhatsApp. Para o volume da loja hoje
 * isso é bem mais simples do que travar o banco a cada venda.
 */
export async function baixarEstoque(itens: ItemPedido[]): Promise<void> {
  const db = getDb();
  for (const item of itens) {
    // Item com recheio desconta do recheio; sem recheio, do doce.
    if (item.saborId) {
      await db
        .update(sabores)
        .set({ estoque: sql`greatest(coalesce(${sabores.estoque}, 0) - ${item.quantidade}, 0)` })
        .where(sql`${sabores.id} = ${item.saborId} and ${sabores.estoque} is not null`);
      continue;
    }
    await db
      .update(produtos)
      .set({ estoque: sql`greatest(coalesce(${produtos.estoque}, 0) - ${item.quantidade}, 0)` })
      .where(sql`${produtos.id} = ${item.produtoId} and ${produtos.estoque} is not null`);
  }
}

/** Devolve ao estoque o que um pedido cancelado tinha reservado. */
export async function devolverAoEstoque(itens: ItemPedido[]): Promise<void> {
  const db = getDb();
  for (const item of itens) {
    if (item.saborId) {
      await db
        .update(sabores)
        .set({ estoque: sql`coalesce(${sabores.estoque}, 0) + ${item.quantidade}` })
        .where(sql`${sabores.id} = ${item.saborId} and ${sabores.estoque} is not null`);
      continue;
    }
    await db
      .update(produtos)
      .set({ estoque: sql`coalesce(${produtos.estoque}, 0) + ${item.quantidade}` })
      .where(sql`${produtos.id} = ${item.produtoId} and ${produtos.estoque} is not null`);
  }
}

/** Estoque atual de um doce, para conferência pontual. */
export async function estoqueDoProduto(produtoId: string): Promise<number | null> {
  const [linha] = await getDb()
    .select({ estoque: produtos.estoque })
    .from(produtos)
    .where(eq(produtos.id, produtoId));
  return linha?.estoque ?? null;
}
