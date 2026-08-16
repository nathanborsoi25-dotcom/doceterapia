import { NextResponse } from "next/server";
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { pedidos, stories } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

/**
 * O que está esperando a Camily no painel.
 *
 * Ela abria o painel e precisava entrar em cada tela pra descobrir se tinha
 * acontecido alguma coisa: venda nova, cancelamento, estorno que não saiu.
 * Aqui os números vêm de uma vez, e a home do painel destaca só o que pede
 * ação — o resto ela olha quando quiser.
 */
export async function GET() {
  const negado = await requireAdmin();
  if (negado) return negado;

  const db = getDb();
  const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const seteDias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const conta = async (condicao: Parameters<typeof db.select>[0] extends never ? never : any) => {
    const [linha] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(pedidos)
      .where(condicao);
    return linha?.n ?? 0;
  };

  const [
    pagos,
    emPreparo,
    prontos,
    aCaminho,
    canceladosRecentes,
    reembolsoFalhou,
    aguardandoPagamento,
    storiesPendentes,
  ] = await Promise.all([
    // Pago e ainda não preparado: é o que ela precisa COMEÇAR.
    conta(eq(pedidos.status, "pago")),
    conta(eq(pedidos.status, "em_preparo")),
    // Pronto é o que está esperando ALGUÉM: a entrega sair ou a cliente vir
    // buscar. Some da vista fácil se não for contado aqui.
    conta(eq(pedidos.status, "pronto")),
    conta(eq(pedidos.status, "a_caminho")),
    // Cancelamento das últimas 24h — o que ela talvez ainda não tenha visto.
    conta(and(eq(pedidos.status, "cancelado"), gte(pedidos.canceladoEm, ontem))),
    // Estorno que o Mercado Pago recusou: dinheiro que a cliente espera de
    // volta e não recebeu. É o mais urgente da lista.
    conta(eq(pedidos.statusReembolso, "falhou")),
    // Carrinho que virou pedido e parou no pagamento (últimos 7 dias).
    conta(
      and(
        eq(pedidos.status, "aguardando_pagamento"),
        gte(pedidos.criadoEm, seteDias)
      )
    ),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(stories)
      .where(eq(stories.situacao, "pendente"))
      .then((r) => r[0]?.n ?? 0),
  ]);

  return NextResponse.json({
    pagos,
    emPreparo,
    prontos,
    aCaminho,
    canceladosRecentes,
    reembolsoFalhou,
    aguardandoPagamento,
    storiesPendentes,
    /** Quantos itens merecem um aviso vermelho na home. */
    precisamDeAcao: pagos + reembolsoFalhou,
  });
}
