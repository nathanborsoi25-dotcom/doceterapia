import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { unstable_noStore as naoGuardar } from "next/cache";
import { getDb } from "@/lib/db";
import { pedidos } from "@/lib/db/schema";
import { getClienteLogado } from "@/lib/cliente-logado";
import { totalDoPedido } from "@/lib/total-pedido";

export const dynamic = "force-dynamic";

/**
 * Cobra um pedido SEM sair do site.
 *
 * O cartão nunca passa por aqui: o Payment Brick tokeniza o número no
 * navegador da cliente, direto com o Mercado Pago, e o que chega nesta rota é
 * só um `token` de uso único. No Pix não há nem isso — o Mercado Pago devolve
 * o QR e o código copia-e-cola.
 *
 * ⚠️ **O VALOR NÃO VEM DO NAVEGADOR.** Ele é recalculado a partir do pedido
 * gravado, como toda conta de dinheiro deste projeto. Aceitar o valor da tela
 * deixaria alguém pagar R$ 1,00 numa torta de R$ 65,00 — é a mesma regra que
 * já vale na criação do pedido.
 *
 * ⚠️ Quem confirma a venda continua sendo o **webhook**: é ele que muda o
 * pedido para "pago", credita pontos e baixa estoque. Esta rota só abre a
 * cobrança. Assim os dois caminhos (aqui e o Checkout Pro) terminam no mesmo
 * lugar, e não existe uma segunda forma de dar pedido por pago.
 */

type Corpo = {
  pedidoId?: string;
  /** "pix" ou "cartao". */
  metodo?: "pix" | "cartao";
  /** Token do cartão, gerado pelo Brick no navegador. */
  token?: string;
  /** Bandeira/meio que o Brick identificou ("visa", "master"...). */
  paymentMethodId?: string;
  /** Sempre 1: a loja não parcela. */
  installments?: number;
  /** CPF de quem paga, quando o Brick pede. */
  documento?: string;
};

export async function POST(req: Request) {
  naoGuardar();

  const cliente = await getClienteLogado();
  if (!cliente) {
    return NextResponse.json({ error: "Faça login para pagar." }, { status: 401 });
  }

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json({ error: "Pagamento ainda não configurado." }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as Corpo;
  const metodo = body.metodo === "cartao" ? "cartao" : "pix";

  if (!body.pedidoId) {
    return NextResponse.json({ error: "Pedido não informado." }, { status: 400 });
  }

  const db = getDb();
  const [pedido] = await db.select().from(pedidos).where(eq(pedidos.id, body.pedidoId));

  if (!pedido) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }
  // O pedido é de quem está logado — senão dava pra pagar (ou espiar) o pedido
  // dos outros só trocando o id no endereço.
  if (pedido.clienteId !== cliente.id) {
    return NextResponse.json({ error: "Este pedido não é seu." }, { status: 403 });
  }
  if (pedido.status !== "aguardando_pagamento") {
    return NextResponse.json(
      { error: "Este pedido já foi pago ou cancelado." },
      { status: 409 }
    );
  }

  const valor = await totalDoPedido(pedido, metodo === "pix" ? "pix" : "credito");
  if (valor <= 0) {
    return NextResponse.json({ error: "Não há valor a cobrar." }, { status: 400 });
  }

  /*
   * A chave de idempotência é o par pedido+método: se a cliente tocar duas
   * vezes no botão, ou a rede repetir a chamada, o Mercado Pago devolve o
   * MESMO pagamento em vez de criar dois. Sem isso, dois toques cobrariam
   * duas vezes o mesmo doce.
   */
  const chaveIdempotencia = `${pedido.id}-${metodo}`;

  const corpo: Record<string, unknown> = {
    transaction_amount: valor,
    description: `Doceterapia — pedido ${pedido.id.slice(0, 8)}`,
    external_reference: pedido.id,
    // Para onde o Mercado Pago avisa que o pagamento saiu. É o MESMO webhook
    // do Checkout Pro: os dois caminhos confirmam a venda pelo mesmo lugar.
    notification_url: `${new URL(req.url).origin}/api/pagamento/webhook`,
    payer: {
      email: cliente.email,
      first_name: cliente.nome?.split(" ")[0] ?? undefined,
      ...(body.documento
        ? {
            identification: {
              type: "CPF",
              number: body.documento.replace(/\D/g, ""),
            },
          }
        : {}),
    },
  };

  if (metodo === "pix") {
    corpo.payment_method_id = "pix";
  } else {
    if (!body.token) {
      return NextResponse.json({ error: "Dados do cartão incompletos." }, { status: 400 });
    }
    corpo.token = body.token;
    corpo.payment_method_id = body.paymentMethodId;
    // A loja vende à vista: parcelamento não é oferecido em lugar nenhum.
    corpo.installments = 1;
  }

  try {
    const resposta = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-Idempotency-Key": chaveIdempotencia,
      },
      body: JSON.stringify(corpo),
      cache: "no-store",
    });

    const dados = (await resposta.json()) as {
      id?: number;
      status?: string;
      status_detail?: string;
      message?: string;
      point_of_interaction?: {
        transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string };
      };
    };

    if (!resposta.ok) {
      /*
       * A recusa CRUA volta para a tela de propósito, como no diagnóstico de
       * pagamento: sem isso o motivo fica só no log da Vercel, que a conexão
       * daqui não consegue ler — e a gente já perdeu dias assim.
       */
      return NextResponse.json(
        {
          error: "O Mercado Pago recusou o pagamento.",
          detalhe: dados.message ?? dados.status_detail ?? `HTTP ${resposta.status}`,
        },
        { status: 502 }
      );
    }

    // Guarda o id do pagamento no pedido: é por ele que o estorno acontece.
    if (dados.id) {
      await db
        .update(pedidos)
        .set({ pagamentoId: String(dados.id) })
        .where(eq(pedidos.id, pedido.id));
    }

    const pix = dados.point_of_interaction?.transaction_data;

    return NextResponse.json({
      ok: true,
      pagamentoId: dados.id ? String(dados.id) : null,
      // "approved" (cartão aprovado), "pending" (Pix esperando), "rejected"...
      situacao: dados.status ?? "pending",
      motivo: dados.status_detail ?? null,
      valor,
      pix: pix
        ? {
            copiaECola: pix.qr_code ?? null,
            qrCodeBase64: pix.qr_code_base64 ?? null,
            link: pix.ticket_url ?? null,
          }
        : null,
    });
  } catch (e) {
    console.error("Falha ao cobrar dentro do site:", e);
    return NextResponse.json(
      { error: "Não consegui falar com o Mercado Pago agora. Tente de novo." },
      { status: 502 }
    );
  }
}
