import { NextResponse } from "next/server";
import { Preference } from "mercadopago";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { carrinhos, configFrete, cupons, pedidos, produtos, sabores } from "@/lib/db/schema";
import { getClienteLogado } from "@/lib/cliente-logado";
import { getMpClient } from "@/lib/mercadopago";
import { calcularFretePorEndereco, configuracaoFretePadrao } from "@/lib/shipping";
import { checarAreaEntrega } from "@/lib/area-entrega";
import { dataMinimaRetirada, prazoMaximoEmDias } from "@/lib/prazo";
import { avaliarCupom, normalizarCodigo } from "@/lib/cupom";
import { conferirEstoque, mensagemDeFalta } from "@/lib/estoque";
import { prazoDoSabor } from "@/lib/sabores";
import { sql } from "drizzle-orm";
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
  const body = (await req.json().catch(() => ({}))) as Partial<Corpo> & {
    cupom?: string;
  };
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

  // Os recheios também saem do banco: o preço de um sabor é tão forjável
  // quanto o do doce se vier do navegador.
  const recheios = await db.select().from(sabores).where(inArray(sabores.produtoId, ids));
  const saborPorId = new Map(recheios.map((s) => [s.id, s]));

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

    // Recheio escolhido: precisa existir, ser deste doce e estar no cardápio.
    const sabor = recebido?.saborId ? saborPorId.get(recebido.saborId) : undefined;
    if (recebido?.saborId && (!sabor || sabor.produtoId !== produto.id || !sabor.ativo)) {
      return NextResponse.json(
        { error: `O recheio escolhido para ${produto.nome} não está mais disponível.` },
        { status: 400 }
      );
    }

    itens.push({
      produtoId: produto.id,
      nome: produto.nome,
      precoUnitario: sabor?.preco != null ? sabor.preco : produto.preco,
      quantidade,
      saborId: sabor?.id,
      saborNome: sabor?.nome,
    });
  }

  // Estoque conferido no servidor: entre montar o carrinho e clicar em pagar
  // o último doce pode ter sido vendido pra outra pessoa.
  const faltas = conferirEstoque(itens, porId, saborPorId);
  if (faltas.length > 0) {
    return NextResponse.json({ error: mensagemDeFalta(faltas) }, { status: 409 });
  }

  // Prazo de encomenda: o maior do carrinho. Quando o item tem recheio, o
  // prazo é o DELE — a torta de Nutella pode estar pronta e a de morango não.
  const prazoDias = prazoMaximoEmDias(
    itens.map((i) => {
      const produto = porId.get(i.produtoId);
      if (!produto) return 0;
      const sabor = i.saborId ? saborPorId.get(i.saborId) : undefined;
      return prazoDoSabor(
        { disponibilidade: produto.disponibilidade as "pronta_entrega" | "sob_encomenda", prazoDias: produto.prazoDias ?? undefined },
        sabor
          ? {
              disponibilidade: sabor.disponibilidade as
                | "pronta_entrega"
                | "sob_encomenda"
                | null,
              prazoDias: sabor.prazoDias,
            }
          : null
      );
    })
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

  // 5) Cupom de desconto, se o cliente informou. A regra e o valor saem do
  // banco: o desconto que vier do navegador é ignorado.
  const subtotal = itens.reduce((a, i) => a + i.precoUnitario * i.quantidade, 0);
  let desconto = 0;
  let cupomCodigo: string | null = null;

  const codigoInformado = normalizarCodigo(body.cupom ?? "");
  if (codigoInformado) {
    const [cupom] = await db
      .select()
      .from(cupons)
      .where(eq(cupons.codigo, codigoInformado));
    const r = avaliarCupom(cupom, subtotal, cliente.id);
    if (!r.valido) {
      return NextResponse.json({ error: r.motivo }, { status: 400 });
    }
    desconto = r.desconto;
    cupomCodigo = r.cupom.codigo;
  }

  // 6) Só agora precisamos do Mercado Pago — as validações acima já
  // recusaram o que não dá pra vender, sem depender do gateway.
  const client = getMpClient();
  if (!client) {
    return NextResponse.json(
      { error: "Pagamento ainda não configurado." },
      { status: 503 }
    );
  }

  // 7) Cria o pedido no banco (status "aguardando_pagamento").
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
    cupomCodigo,
    desconto,
    formaPagamento: body.formaPagamento ?? "pix",
    status: "aguardando_pagamento",
  });

  // Marca o uso do cupom, pra respeitar o limite que a Camily definiu.
  if (cupomCodigo) {
    await db
      .update(cupons)
      .set({ usos: sql`${cupons.usos} + 1` })
      .where(eq(cupons.codigo, cupomCodigo));
  }

  // O carrinho virou pedido: sai da lista de "abandonados" da Camily.
  await db.delete(carrinhos).where(eq(carrinhos.clienteId, cliente.id));

  // 8) Cria a preferência de pagamento no Mercado Pago.
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
      // O desconto do cupom vai como item negativo, que é como o Mercado
      // Pago aceita abatimento: o total cobrado já sai certo na tela dele.
      ...(desconto > 0
        ? {
            items: [
              ...itens.map((i) => ({
                id: i.produtoId,
                title: i.nome,
                quantity: i.quantidade,
                unit_price: i.precoUnitario,
                currency_id: "BRL",
              })),
              {
                id: "desconto",
                title: `Desconto (cupom ${cupomCodigo})`,
                quantity: 1,
                unit_price: -desconto,
                currency_id: "BRL",
              },
            ],
          }
        : {}),
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
