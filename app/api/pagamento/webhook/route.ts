import { NextResponse } from "next/server";
import { Payment } from "mercadopago";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { pedidos } from "@/lib/db/schema";
import { getMpClient } from "@/lib/mercadopago";
import { avisarMudancaDeStatus } from "@/lib/avisar-cliente";
import {
  devolverPagamentoDePedidoCancelado,
  registrarCancelamentoDoMercadoPago,
} from "@/lib/cancelamento";
import { creditarPontosDoPedido } from "@/lib/fidelidade";
import { baixarEstoque } from "@/lib/estoque";
import type { Pedido } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Webhook do Mercado Pago: o MP chama esta rota quando o status de um
 * pagamento muda. A gente busca o pagamento no MP (fonte da verdade, usando
 * nosso token) e atualiza o status do pedido no banco. Sempre responde 200
 * rápido — se der erro, o MP tenta de novo.
 */
function mapearStatus(mpStatus: string | undefined): Pedido["status"] | null {
  switch (mpStatus) {
    case "approved":
      return "pago";
    case "pending":
    case "in_process":
    case "authorized":
      return "aguardando_pagamento";
    case "rejected":
    case "cancelled":
    case "refunded":
    case "charged_back":
      return "cancelado";
    default:
      return null;
  }
}

export async function POST(req: Request) {
  const client = getMpClient();
  if (!client) return NextResponse.json({ ok: true });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // MP às vezes manda os dados só na query string.
  }

  const url = new URL(req.url);
  const tipo =
    (body.type as string) ||
    (body.topic as string) ||
    url.searchParams.get("type") ||
    url.searchParams.get("topic");
  const data = body.data as { id?: string | number } | undefined;
  const paymentId =
    data?.id ??
    url.searchParams.get("data.id") ??
    url.searchParams.get("id");

  if (tipo !== "payment" || !paymentId) {
    return NextResponse.json({ ok: true });
  }

  try {
    const payment = new Payment(client);
    const info = await payment.get({ id: String(paymentId) });
    const pedidoId = info.external_reference;
    const novoStatus = mapearStatus(info.status);

    if (pedidoId && novoStatus) {
      const db = getDb();
      // Só avisa se a situação realmente mudou: o Mercado Pago manda a
      // mesma notificação mais de uma vez, e o cliente não pode receber
      // três e-mails iguais dizendo que o pagamento foi confirmado.
      const [antes] = await db
        .select({ status: pedidos.status, pagamentoId: pedidos.pagamentoId })
        .from(pedidos)
        .where(eq(pedidos.id, pedidoId));

      // Guarda o número do pagamento: é com ele que se pede o estorno depois.
      // O pagamento APROVADO manda no registro — um pedido pode ter tentativas
      // recusadas antes, e estornar a recusada não devolveria nada.
      if (antes && (info.status === "approved" || !antes.pagamentoId)) {
        await db
          .update(pedidos)
          .set({ pagamentoId: String(paymentId) })
          .where(eq(pedidos.id, pedidoId));
      }

      // Pagamento que caiu depois do cancelamento: o link do Mercado Pago
      // continua funcionando, então dá pra cancelar e pagar em seguida sem
      // perceber. O dinheiro entrou por engano — devolve na hora.
      if (antes?.status === "cancelado" && info.status === "approved") {
        await devolverPagamentoDePedidoCancelado(pedidoId, String(paymentId));
        return NextResponse.json({ ok: true });
      }

      if (antes && antes.status !== novoStatus) {
        // Estorno feito pela Camily direto no site do Mercado Pago: o
        // cancelamento tem que desfazer pontos e cupom aqui também.
        if (novoStatus === "cancelado") {
          await registrarCancelamentoDoMercadoPago(pedidoId, {
            reembolsado: info.status === "refunded" || info.status === "charged_back",
          });
          return NextResponse.json({ ok: true });
        }

        await db
          .update(pedidos)
          .set({ status: novoStatus })
          .where(eq(pedidos.id, pedidoId));
        await avisarMudancaDeStatus(pedidoId, novoStatus);

        // Pagamento confirmado: agora sim o cliente ganha os pontos e o
        // estoque baixa. Fazer isso na criação do pedido daria pontos por
        // compra nunca paga e seguraria doce de carrinho abandonado.
        if (novoStatus === "pago") {
          const [p] = await db
            .select()
            .from(pedidos)
            .where(eq(pedidos.id, pedidoId));
          if (p) await baixarEstoque(p.itens);
          if (p?.clienteId) {
            const subtotal = p.itens.reduce(
              (a, i) => a + i.precoUnitario * i.quantidade,
              0
            );
            await creditarPontosDoPedido(
              p.clienteId,
              p.id,
              Math.max(0, subtotal - p.desconto)
            );
          }
        }
      }
    }
  } catch {
    // Não falha o webhook — o MP re-tenta a notificação.
  }

  return NextResponse.json({ ok: true });
}
