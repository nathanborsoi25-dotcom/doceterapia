import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { pedidos, produtos, sabores } from "@/lib/db/schema";
import { getClienteLogado } from "@/lib/cliente-logado";
import { getMpClient } from "@/lib/mercadopago";
import { conferirEstoque, mensagemDeFalta } from "@/lib/estoque";
import { criarPreferenciaDoPedido } from "@/lib/preferencia-mp";
import { descontoDoPix } from "@/lib/desconto-pix";
import { getConfigLoja } from "@/lib/config-loja";
import type { ItemPedido } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Voltar para pagar um pedido que ficou parado.
 *
 * Se a cliente fecha a tela do Mercado Pago sem concluir, o pedido fica em
 * "aguardando pagamento" e antes não havia caminho de volta: ela precisava
 * montar o carrinho de novo, e o pedido velho ficava encalhado no painel da
 * Camily. Aqui a mesma cobrança é reaberta, com os valores JÁ GRAVADOS no
 * pedido — nada é recalculado, então o preço não muda debaixo dela.
 *
 * O que é conferido de novo:
 * - o pedido é dela (vem da sessão, não do navegador);
 * - ainda está aguardando pagamento — pago, em preparo ou cancelado não;
 * - os doces ainda existem em estoque, senão ela pagaria por algo que acabou.
 *
 * O cupom NÃO é contado de novo: o uso já foi marcado quando o pedido nasceu.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const cliente = await getClienteLogado();
  if (!cliente) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const db = getDb();
  const [pedido] = await db
    .select()
    .from(pedidos)
    .where(and(eq(pedidos.id, params.id), eq(pedidos.clienteId, cliente.id)));

  if (!pedido) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  if (pedido.status !== "aguardando_pagamento") {
    return NextResponse.json(
      {
        error:
          pedido.status === "cancelado"
            ? "Este pedido foi cancelado. Faça um novo pedido pelo cardápio."
            : "Este pedido já foi pago. 🍒",
      },
      { status: 400 }
    );
  }

  const itens = pedido.itens as ItemPedido[];
  if (!Array.isArray(itens) || itens.length === 0) {
    return NextResponse.json(
      { error: "Este pedido está sem itens. Fale com a Camily pelo WhatsApp." },
      { status: 400 }
    );
  }

  // Estoque: entre a desistência e a volta, o doce pode ter acabado.
  const ids = Array.from(new Set(itens.map((i) => i.produtoId)));
  const [listaProdutos, listaSabores] = await Promise.all([
    db.select().from(produtos).where(inArray(produtos.id, ids)),
    db.select().from(sabores).where(inArray(sabores.produtoId, ids)),
  ]);

  const falta = conferirEstoque(
    itens,
    new Map(listaProdutos.map((p) => [p.id, p])),
    new Map(listaSabores.map((s) => [s.id, s]))
  );
  if (falta.length > 0) {
    return NextResponse.json({ error: mensagemDeFalta(falta) }, { status: 409 });
  }

  const client = getMpClient();
  if (!client) {
    return NextResponse.json(
      { error: "Pagamento ainda não configurado." },
      { status: 503 }
    );
  }

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;

  /*
   * Ela pode TROCAR a forma de pagamento ao voltar.
   *
   * Quem desistiu do cartão e resolveu pagar no Pix ganha os 4% agora; quem
   * fez o contrário perde o desconto. Antes a retomada repetia a forma do
   * pedido original, e a única saída pra trocar era cancelar e refazer o
   * carrinho inteiro.
   *
   * ⚠️ O valor do desconto é RECALCULADO aqui, nunca aproveitado do pedido.
   * Reabrir no cartão mantendo o abatimento do Pix faria a Camily pagar os 4%
   * E a taxa cheia do cartão — que é exatamente o buraco que a trava de forma
   * existe pra fechar.
   */
  const corpo = (await req.json().catch(() => ({}))) as {
    formaPagamento?: string;
    /** Cobrar dentro do site (Payment Brick), sem abrir o Checkout Pro. */
    pagarNoSite?: boolean;
  };
  const formaPagamento = corpo.formaPagamento === "credito" ? "credito" : "pix";

  const configLoja = await getConfigLoja();
  const subtotal = itens.reduce((a, i) => a + i.precoUnitario * i.quantidade, 0);
  const descontoPix = descontoDoPix(
    formaPagamento,
    Math.max(0, subtotal - pedido.desconto + pedido.valorFrete),
    configLoja.descontoPix
  );

  // O pedido passa a valer o que ela escolheu agora — é este valor que o
  // painel mostra, que as métricas usam pra taxa e que o e-mail conta.
  if (formaPagamento !== pedido.formaPagamento || descontoPix !== pedido.descontoPix) {
    await db
      .update(pedidos)
      .set({ formaPagamento, descontoPix })
      .where(eq(pedidos.id, pedido.id));
  }

  /*
   * Pagando aqui dentro: a forma nova já foi gravada acima (com o desconto do
   * Pix refeito), e é só isso que esta rota precisa fazer. Quem cobra é
   * `/api/pagamento/processar`, que recalcula o valor do zero — o número
   * devolvido aqui serve para a tela mostrar antes de a cliente confirmar.
   */
  if (corpo.pagarNoSite) {
    const subtotalDoPedido = itens.reduce(
      (a, i) => a + i.precoUnitario * i.quantidade,
      0
    );
    const aCobrar = Math.max(
      0,
      subtotalDoPedido - pedido.desconto + pedido.valorFrete - descontoPix
    );
    return NextResponse.json({
      pagarNoSite: true,
      formaPagamento,
      total: Number(aCobrar.toFixed(2)),
    });
  }

  const url = await criarPreferenciaDoPedido(client, {
    pedidoId: pedido.id,
    itens,
    valorFrete: pedido.valorFrete,
    desconto: pedido.desconto,
    descontoPix,
    cupomCodigo: pedido.cupomCodigo,
    comprador: {
      nome: cliente.nome,
      email: cliente.email,
      telefone: cliente.telefone,
    },
    origin,
    formaPagamento,
  });

  if (!url) {
    return NextResponse.json(
      { error: "Não consegui abrir o pagamento agora. Tenta de novo?" },
      { status: 502 }
    );
  }

  return NextResponse.json({ url });
}
