import { and, eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import { pedidos, pontos } from "./db/schema";
import { getConfigLoja } from "./config-loja";
import type { ItemPedido } from "./types";

/**
 * Pontos de fidelidade. O saldo é sempre a SOMA do extrato — nunca um número
 * guardado à parte, que poderia divergir do histórico.
 */

export async function saldoDePontos(clienteId: string): Promise<number> {
  const [linha] = await getDb()
    .select({ saldo: sql<number>`coalesce(sum(${pontos.quantidade}), 0)::int` })
    .from(pontos)
    .where(eq(pontos.clienteId, clienteId));
  return linha?.saldo ?? 0;
}

export async function extratoDePontos(clienteId: string) {
  return getDb()
    .select()
    .from(pontos)
    .where(eq(pontos.clienteId, clienteId))
    .orderBy(sql`${pontos.criadoEm} desc`);
}

/** Lança um movimento no extrato. Positivo ganha, negativo gasta. */
export async function lancarPontos(dados: {
  clienteId: string;
  quantidade: number;
  motivo: "pedido" | "avaliacao" | "resgate" | "estorno" | "story";
  descricao?: string;
  pedidoId?: string | null;
}): Promise<void> {
  if (!dados.quantidade) return;
  await getDb().insert(pontos).values({
    id: crypto.randomUUID(),
    clienteId: dados.clienteId,
    quantidade: Math.round(dados.quantidade),
    motivo: dados.motivo,
    descricao: dados.descricao ?? "",
    pedidoId: dados.pedidoId ?? null,
  });
}

/**
 * Credita os pontos da compra, usando a regra que a Camily configurou.
 * Chamado quando o pagamento é confirmado — não na criação do pedido, senão
 * daria pontos por compra que nunca foi paga.
 */
export async function creditarPontosDoPedido(
  clienteId: string,
  pedidoId: string,
  valorPago: number
): Promise<number> {
  const config = await getConfigLoja();
  const ganhos = Math.floor(valorPago * config.pontosPorReal);
  if (ganhos <= 0) return 0;

  await lancarPontos({
    clienteId,
    quantidade: ganhos,
    motivo: "pedido",
    descricao: `Compra de R$ ${valorPago.toFixed(2)}`,
    pedidoId,
  });
  return ganhos;
}

/**
 * Garante que a compra pontuou — sem correr o risco de pontuar duas vezes.
 *
 * ⚠️ **Existe por causa de um caso real (16/08/2026).** A Mariana fez dois
 * pedidos iguais e pagou um; como não dava pra saber qual, a loja cancelou um
 * e marcou o outro como entregue — só que o cancelado era o que tinha o
 * pagamento registrado. O cancelamento estornou os pontos, e o pedido que
 * ficou de pé nunca passou pelo webhook (foi concluído à mão), então nunca
 * creditou nada. Ela pagou, recebeu o doce e ficou com saldo zero.
 *
 * Agora, quando a Camily marca um pedido como pago (ou qualquer etapa
 * seguinte) direto no painel, os pontos daquela compra entram se ainda não
 * tiverem entrado. A guarda é o próprio extrato: se já existe lançamento de
 * "pedido" para este pedido, não faz nada.
 *
 * Não mexe em estoque de propósito: não há como saber se ele já baixou, e
 * descontar duas vezes esgotaria um doce que existe.
 */
export async function garantirPontosDaCompra(pedidoId: string): Promise<number> {
  const db = getDb();

  const [pedido] = await db.select().from(pedidos).where(eq(pedidos.id, pedidoId));
  if (!pedido?.clienteId) return 0;

  const jaLancado = await db
    .select({ id: pontos.id })
    .from(pontos)
    .where(and(eq(pontos.pedidoId, pedidoId), eq(pontos.motivo, "pedido")));
  if (jaLancado.length > 0) return 0;

  const subtotal = (pedido.itens ?? []).reduce(
    (soma, i) => soma + i.precoUnitario * i.quantidade,
    0
  );

  return creditarPontosDoPedido(
    pedido.clienteId,
    pedidoId,
    Math.max(0, subtotal - pedido.desconto)
  );
}

/**
 * Desconta os pontos dos prêmios que vieram no pedido.
 *
 * Só é chamado quando o pagamento é confirmado, igual ao crédito da compra:
 * debitar no clique do resgate cobraria por um pedido que talvez nunca fosse
 * pago, e obrigaria a devolver os pontos em todo carrinho abandonado.
 *
 * O saldo já foi conferido na criação do pedido; aqui é o lançamento.
 */
export async function debitarResgatesDoPedido(
  clienteId: string,
  pedidoId: string,
  itens: ItemPedido[]
): Promise<number> {
  const premios = itens.filter((i) => i.recompensaId && (i.pontosGastos ?? 0) > 0);
  let total = 0;

  for (const premio of premios) {
    const custo = (premio.pontosGastos ?? 0) * premio.quantidade;
    await lancarPontos({
      clienteId,
      quantidade: -custo,
      motivo: "resgate",
      descricao: `Resgate: ${premio.nome}`,
      pedidoId,
    });
    total += custo;
  }
  return total;
}

/*
 * A devolução dos pontos de um prêmio em pedido cancelado NÃO mora aqui: quem
 * faz isso é `estornarPontosDoPedido`, em `lib/cancelamento.ts`, que lança o
 * oposto de tudo que o pedido movimentou — ganho e gasto de uma vez. Ter duas
 * funções mexendo no mesmo extrato acabaria devolvendo em dobro.
 */
