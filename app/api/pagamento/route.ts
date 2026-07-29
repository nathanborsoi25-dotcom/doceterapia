import { NextResponse } from "next/server";
import { Preference } from "mercadopago";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { clientes, configFrete, pedidos } from "@/lib/db/schema";
import { getMpClient } from "@/lib/mercadopago";
import { calcularFretePorEndereco, configuracaoFretePadrao } from "@/lib/shipping";
import { checarAreaEntrega } from "@/lib/area-entrega";
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
  const body = (await req.json().catch(() => ({}))) as Partial<Corpo>;
  const itens = (body.itens ?? []) as ItemPedido[];
  if (!Array.isArray(itens) || itens.length === 0) {
    return NextResponse.json({ error: "Carrinho vazio." }, { status: 400 });
  }

  const db = getDb();
  const tipoEntrega = body.tipoEntrega ?? "entrega";

  // Endereço de referência: preferimos o que está gravado no banco, porque o
  // que vem na requisição pode ter sido adulterado no navegador.
  const [cliente] = body.clienteId
    ? await db.select().from(clientes).where(eq(clientes.id, body.clienteId))
    : [];

  // 1) A Doceterapia só atende Arapongas-PR. Mesma checagem que o checkout
  // faz na tela, repetida aqui pra não dar pra burlar pelo navegador.
  const area = checarAreaEntrega({
    cep: cliente?.cep ?? body.enderecoEntrega?.cep,
    cidade: cliente?.cidade ?? body.enderecoEntrega?.cidade,
    bairro: cliente?.bairro ?? body.enderecoEntrega?.bairro,
    rua: cliente?.rua ?? body.enderecoEntrega?.rua,
  });
  if (!area.atendido) {
    return NextResponse.json(
      { error: `${area.motivo} Fale com a Camily pelo WhatsApp para combinar seu pedido.` },
      { status: 400 }
    );
  }

  // 2) Recalcula o frete NO SERVIDOR. O valor que vem do navegador não é
  // confiável (dá pra forjar), então ele é ignorado: as coordenadas saem do
  // cadastro salvo no banco e a tabela de faixas também.
  let valorFrete = 0;
  if (tipoEntrega === "entrega") {
    const [linhaCfg] = await db
      .select()
      .from(configFrete)
      .where(eq(configFrete.id, "default"));
    const config = linhaCfg
      ? { origem: linhaCfg.origem, faixas: linhaCfg.faixas }
      : configuracaoFretePadrao;

    const lat = cliente?.lat ?? body.enderecoEntrega?.lat;
    const lng = cliente?.lng ?? body.enderecoEntrega?.lng;

    if (lat == null || lng == null) {
      return NextResponse.json(
        { error: "Não foi possível calcular o frete para o seu endereço." },
        { status: 400 }
      );
    }

    const calculo = calcularFretePorEndereco(lat, lng, config);
    if (calculo.valor === null) {
      return NextResponse.json(
        { error: "Endereço fora da área de entrega." },
        { status: 400 }
      );
    }
    valorFrete = calculo.valor;
  }

  // 3) Só agora precisamos do Mercado Pago — as validações acima já
  // recusaram o que não dá pra vender, sem depender do gateway.
  const client = getMpClient();
  if (!client) {
    return NextResponse.json(
      { error: "Pagamento ainda não configurado." },
      { status: 503 }
    );
  }

  // 4) Cria o pedido no banco (status "aguardando_pagamento").
  const id = crypto.randomUUID();
  await db.insert(pedidos).values({
    id,
    clienteId: body.clienteId || null,
    itens,
    tipoEntrega,
    dataAgendada: body.dataAgendada ?? "",
    enderecoEntrega: body.enderecoEntrega ?? null,
    valorFrete,
    formaPagamento: body.formaPagamento ?? "pix",
    status: "aguardando_pagamento",
  });

  // 5) Cria a preferência de pagamento no Mercado Pago.
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
      payment_methods: {
        // Crédito à vista (sem parcelamento).
        installments: 1,
        default_installments: 1,
        // Remove Boleto. Mantém Pix (bank_transfer), crédito e débito
        // (debit_card) — de qualquer banco que o Mercado Pago oferecer.
        excluded_payment_types: [{ id: "ticket" }],
      },
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
