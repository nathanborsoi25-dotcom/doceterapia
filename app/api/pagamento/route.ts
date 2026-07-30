import { NextResponse } from "next/server";
import { Preference } from "mercadopago";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { configFrete, pedidos, produtos } from "@/lib/db/schema";
import { getClienteLogado } from "@/lib/cliente-logado";
import { getMpClient } from "@/lib/mercadopago";
import { calcularFretePorEndereco, configuracaoFretePadrao } from "@/lib/shipping";
import { checarAreaEntrega } from "@/lib/area-entrega";
import { dataMinimaRetirada, prazoMaximoEmDias } from "@/lib/prazo";
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

/** Limite de segurança: ninguém pede 500 brigadeiros por engano. */
const QUANTIDADE_MAXIMA = 200;

function texto(valor: unknown, limite: number): string {
  return typeof valor === "string" ? valor.trim().slice(0, limite) : "";
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<Corpo>;
  const recebidos = body.itens;
  if (!Array.isArray(recebidos) || recebidos.length === 0) {
    return NextResponse.json({ error: "Carrinho vazio." }, { status: 400 });
  }

  const db = getDb();
  const tipoEntrega = body.tipoEntrega ?? "entrega";

  // 1) Remonta os itens A PARTIR DO BANCO. Nome e preço que vêm do navegador
  // são descartados — só o produtoId e a quantidade são aproveitados —, senão
  // dava pra comprar uma torta de R$ 65,00 por R$ 1,00.
  const ids = Array.from(
    new Set(recebidos.map((i) => i?.produtoId).filter(Boolean) as string[])
  );
  if (ids.length === 0) {
    return NextResponse.json({ error: "Carrinho inválido." }, { status: 400 });
  }

  const doBanco = await db.select().from(produtos).where(inArray(produtos.id, ids));
  const porId = new Map(doBanco.map((p) => [p.id, p]));

  const itens: ItemPedido[] = [];
  for (const recebido of recebidos) {
    const produto = porId.get(recebido?.produtoId);
    if (!produto || !produto.ativo) {
      return NextResponse.json(
        { error: "Um dos doces do seu carrinho não está mais disponível." },
        { status: 400 }
      );
    }

    const quantidade = Math.floor(Number(recebido?.quantidade));
    if (!Number.isFinite(quantidade) || quantidade < 1 || quantidade > QUANTIDADE_MAXIMA) {
      return NextResponse.json(
        { error: "Quantidade inválida no carrinho." },
        { status: 400 }
      );
    }

    itens.push({
      produtoId: produto.id,
      nome: produto.nome,
      precoUnitario: produto.preco,
      quantidade,
    });
  }

  // Prazo de encomenda: o maior entre os doces escolhidos.
  const prazoDias = prazoMaximoEmDias(
    itens.map((i) => porId.get(i.produtoId)?.prazoDias)
  );

  // 2) Quem está comprando sai da SESSÃO, não do que o navegador mandou —
  // assim ninguém faz pedido em nome de outra pessoa, e o endereço usado no
  // frete é sempre o que está cadastrado na conta.
  const cliente = await getClienteLogado();
  if (!cliente) {
    return NextResponse.json(
      { error: "Faça login para finalizar o pedido." },
      { status: 401 }
    );
  }

  // A entrega só vale pra Arapongas-PR. Quem é de fora ainda pode comprar
  // escolhendo Retirada, então a checagem só vale pra entrega.
  if (tipoEntrega === "entrega") {
    const area = checarAreaEntrega({
      cep: cliente.cep,
      cidade: cliente.cidade,
      bairro: cliente.bairro,
      rua: cliente.rua,
    });
    if (!area.atendido) {
      return NextResponse.json(
        {
          error: `Não é possível concluir a compra com entrega: ${area.motivo} Escolha Retirada ou fale com a Camily pelo WhatsApp.`,
        },
        { status: 400 }
      );
    }
  }

  // 3) Recalcula o frete NO SERVIDOR. O valor que vem do navegador não é
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

    const { lat, lng } = cliente;

    if (lat == null || lng == null) {
      return NextResponse.json(
        { error: "Não foi possível calcular o frete para o seu endereço." },
        { status: 400 }
      );
    }

    const calculo = calcularFretePorEndereco(lat, lng, config);
    if (calculo.valor === null) {
      return NextResponse.json(
        {
          error:
            "Não é possível concluir a compra com entrega: seu endereço está distante demais. Escolha Retirada ou fale com a Camily pelo WhatsApp.",
        },
        { status: 400 }
      );
    }
    valorFrete = calculo.valor;
  }

  // 4) Prazo do pedido. Na retirada vale a data que o cliente escolheu, que
  // precisa respeitar o tempo de encomenda; na entrega quem marca a data é a
  // Camily, então o prazo é a data da compra mais o tempo de encomenda.
  const agora = new Date();
  let prazoEm: Date;

  if (tipoEntrega === "retirada") {
    const escolhida = new Date(texto(body.dataAgendada, 40));
    if (Number.isNaN(escolhida.getTime())) {
      return NextResponse.json(
        { error: "Escolha a data e a hora da retirada." },
        { status: 400 }
      );
    }
    // Compara por dia (o cliente pode escolher qualquer hora do dia liberado).
    const minimo = dataMinimaRetirada(prazoDias, agora);
    const escolhidaNoDia = new Date(escolhida);
    escolhidaNoDia.setHours(0, 0, 0, 0);
    if (escolhidaNoDia < minimo) {
      return NextResponse.json(
        {
          error:
            prazoDias > 0
              ? `Um dos doces do seu carrinho é feito sob encomenda e precisa de ${prazoDias} ${prazoDias === 1 ? "dia" : "dias"}. Escolha uma data a partir de ${minimo.toLocaleDateString("pt-BR")}.`
              : "Escolha uma data a partir de hoje.",
        },
        { status: 400 }
      );
    }
    prazoEm = escolhida;
  } else {
    prazoEm = dataMinimaRetirada(prazoDias, agora);
  }

  // 5) Só agora precisamos do Mercado Pago — as validações acima já
  // recusaram o que não dá pra vender, sem depender do gateway.
  const client = getMpClient();
  if (!client) {
    return NextResponse.json(
      { error: "Pagamento ainda não configurado." },
      { status: 503 }
    );
  }

  // 6) Cria o pedido no banco (status "aguardando_pagamento").
  const id = crypto.randomUUID();
  await db.insert(pedidos).values({
    id,
    clienteId: cliente.id,
    itens,
    tipoEntrega,
    // Na entrega o cliente nao agenda: quem marca a data e a Camily.
    dataAgendada: tipoEntrega === "retirada" ? texto(body.dataAgendada, 40) : "",
    prazoEm,
    // Endereço congelado no momento da compra, tirado do cadastro — se o
    // cliente mudar de casa depois, o pedido antigo mantém o endereço certo.
    enderecoEntrega:
      tipoEntrega === "entrega"
        ? {
            rua: cliente.rua,
            numero: cliente.numero,
            bairro: cliente.bairro,
            cidade: cliente.cidade,
            cep: cliente.cep,
            complemento: cliente.complemento ?? undefined,
            lat: cliente.lat ?? undefined,
            lng: cliente.lng ?? undefined,
          }
        : null,
    valorFrete,
    formaPagamento: body.formaPagamento ?? "pix",
    status: "aguardando_pagamento",
  });

  // 7) Cria a preferência de pagamento no Mercado Pago.
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
