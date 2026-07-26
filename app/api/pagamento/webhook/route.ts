import { NextResponse } from "next/server";
import { Payment } from "mercadopago";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { pedidos } from "@/lib/db/schema";
import { getMpClient } from "@/lib/mercadopago";
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
      await db
        .update(pedidos)
        .set({ status: novoStatus })
        .where(eq(pedidos.id, pedidoId));
    }
  } catch {
    // Não falha o webhook — o MP re-tenta a notificação.
  }

  return NextResponse.json({ ok: true });
}
