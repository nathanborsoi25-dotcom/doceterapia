import { NextResponse } from "next/server";
import { Preference } from "mercadopago";
import { getDb } from "@/lib/db";
import { pedidos } from "@/lib/db/schema";
import { getMpClient } from "@/lib/mercadopago";
import type { ItemPedido, Pedido } from "@/lib/types";

export const dynamic = "force-dynamic";

type Corpo = Pick<
  Pedido,
  | "clienteId"
  | "itens"
  | "tipoEntrega"
  | "dataAgendada"
  | "enderecoEntrega"
  | "valorFrete"
  | "formaPagamento"
>;

export async function POST(req: Request) {
  const client = getMpClient();
  if (!client) {
    return NextResponse.json(
      { error: "Pagamento ainda não configurado." },
      { status: 503 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as Partial<Corpo>;
  const itens = (body.itens ?? []) as ItemPedido[];
  if (!Array.isArray(itens) || itens.length === 0) {
    return NextResponse.json({ error: "Carrinho vazio." }, { status: 400 });
  }

  const valorFrete = body.valorFrete ?? 0;

  // 1) Cria o pedido no banco (status "aguardando_pagamento").
  const id = crypto.randomUUID();
  const db = getDb();
  await db.insert(pedidos).values({
    id,
    clienteId: body.clienteId || null,
    itens,
    tipoEntrega: body.tipoEntrega ?? "entrega",
    dataAgendada: body.dataAgendada ?? "",
    enderecoEntrega: body.enderecoEntrega ?? null,
    valorFrete,
    formaPagamento: body.formaPagamento ?? "pix",
    status: "aguardando_pagamento",
  });

  // 2) Cria a preferência de pagamento no Mercado Pago.
  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  const ehLocal = origin.includes("localhost") || origin.includes("127.0.0.1");

  const preference = new Preference(client);
  const pref = await preference.create({
    body: {
      items: itens.map((i) => ({
        id: i.produtoId,
        title: i.nome,
        quantity: i.quantidade,
        unit_price: i.precoUnitario,
        currency_id: "BRL",
      })),
      // Frete entra como custo de envio (quando houver).
      shipments:
        valorFrete > 0 ? { cost: valorFrete, mode: "not_specified" } : undefined,
      external_reference: id,
      back_urls: {
        success: `${origin}/pedido/sucesso`,
        pending: `${origin}/pedido/sucesso`,
        failure: `${origin}/pedido/erro`,
      },
      auto_return: "approved",
      // Sem parcelamento (crédito à vista / débito / Pix).
      payment_methods: { installments: 1 },
      // MP não aceita URL local para notificação; só manda em produção.
      ...(ehLocal
        ? {}
        : { notification_url: `${origin}/api/pagamento/webhook` }),
    },
  });

  return NextResponse.json({
    pedidoId: id,
    url: pref.init_point ?? pref.sandbox_init_point ?? null,
  });
}
