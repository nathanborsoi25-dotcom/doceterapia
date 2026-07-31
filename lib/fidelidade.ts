import { eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import { pontos } from "./db/schema";
import { getConfigLoja } from "./config-loja";

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
  motivo: "pedido" | "avaliacao" | "resgate";
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
