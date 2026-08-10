import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { carrinhos, configFrete, cupons, pedidos, produtos, sabores } from "@/lib/db/schema";
import { getClienteLogado } from "@/lib/cliente-logado";
import { getMpClient } from "@/lib/mercadopago";
import { calcularFretePorEndereco, configuracaoFretePadrao } from "@/lib/shipping";
import { checarAreaEntrega } from "@/lib/area-entrega";
import { geocodificar } from "@/lib/geocode";
import { dataMinimaRetirada, prazoMaximoEmDias } from "@/lib/prazo";
import { descricaoDoPonto, pontoRetiradaPorId, pontosDaLoja } from "@/lib/retirada";
import { getConfigLoja } from "@/lib/config-loja";
import { avaliarCupom, normalizarCodigo } from "@/lib/cupom";
import { conferirEstoque, mensagemDeFalta } from "@/lib/estoque";
import { criarPreferenciaDoPedido } from "@/lib/preferencia-mp";
import { prazoDoSabor } from "@/lib/sabores";
import { sql } from "drizzle-orm";
import type { ItemPedido, Pedido } from "@/lib/types";

export const dynamic = "force-dynamic";

type Corpo = Pick<
  Pedido,
  | "clienteId"
  | "itens"
  | "tipoEntrega"
  | "enderecoEntrega"
  | "valorFrete"
  | "formaPagamento"
  | "ehPresente"
  | "nomeQuemRecebe"
  | "bilhete"
> & {
  /** A cliente pediu para entregar em endereço diferente do cadastro. */
  entregarEmOutroEndereco?: boolean;
  /** Código do ponto onde ela vai buscar (só na retirada). */
  pontoRetirada?: string;
};

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
  const ehPresente = body.ehPresente === true;

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

  /**
   * Para onde vai a entrega.
   *
   * Por padrão é o endereço do cadastro. Mas a cliente pode mandar entregar
   * em OUTRO lugar (presente pra uma amiga, entrega no trabalho) — nesse caso
   * o endereço vem da tela, e por isso ele é tratado como tudo que vem do
   * navegador: os campos são limpos, a área é checada de novo e as
   * coordenadas são buscadas AQUI. Aceitar lat/lng do navegador deixaria
   * alguém informar um ponto pertinho da loja e receber do outro lado da
   * cidade pagando frete de esquina.
   */
  const outroEndereco = body.enderecoEntrega;
  const usaOutroEndereco =
    tipoEntrega === "entrega" && body.entregarEmOutroEndereco === true && outroEndereco;

  const enderecoDestino = usaOutroEndereco
    ? {
        rua: texto(outroEndereco?.rua, 120),
        numero: texto(outroEndereco?.numero, 20),
        bairro: texto(outroEndereco?.bairro, 120),
        cidade: texto(outroEndereco?.cidade, 120),
        cep: texto(outroEndereco?.cep, 12),
        complemento: texto(outroEndereco?.complemento, 120) || undefined,
        lat: undefined as number | undefined,
        lng: undefined as number | undefined,
      }
    : {
        rua: cliente.rua,
        numero: cliente.numero,
        bairro: cliente.bairro,
        cidade: cliente.cidade,
        cep: cliente.cep,
        complemento: cliente.complemento ?? undefined,
        lat: cliente.lat ?? undefined,
        lng: cliente.lng ?? undefined,
      };

  if (usaOutroEndereco && (!enderecoDestino.rua || !enderecoDestino.numero)) {
    return NextResponse.json(
      { error: "Preencha a rua e o número do endereço de entrega." },
      { status: 400 }
    );
  }

  // A entrega só vale pra Arapongas-PR. Quem é de fora ainda pode comprar
  // escolhendo Retirada, então a checagem só vale pra entrega.
  if (tipoEntrega === "entrega") {
    const area = checarAreaEntrega({
      cep: enderecoDestino.cep,
      cidade: enderecoDestino.cidade,
      bairro: enderecoDestino.bairro,
      rua: enderecoDestino.rua,
    });
    if (!area.atendido) {
      return NextResponse.json(
        {
          error: `Não é possível concluir a compra com entrega: ${area.motivo} Escolha Retirada ou fale com a Camily pelo WhatsApp.`,
        },
        { status: 400 }
      );
    }

    // Endereço novo: descobre onde ele fica, aqui no servidor.
    if (usaOutroEndereco) {
      const coords = await geocodificar({
        rua: enderecoDestino.rua,
        numero: enderecoDestino.numero,
        bairro: enderecoDestino.bairro,
        cidade: enderecoDestino.cidade,
        cep: enderecoDestino.cep,
      });
      if (!coords) {
        return NextResponse.json(
          {
            error:
              "Não consegui localizar esse endereço de entrega no mapa. Confira a rua e o número, ou escolha Retirada.",
          },
          { status: 400 }
        );
      }
      enderecoDestino.lat = coords.lat;
      enderecoDestino.lng = coords.lng;
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

    const { lat, lng } = enderecoDestino;

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

  /**
   * 4) Onde a cliente vai buscar, quando é retirada.
   *
   * Só o CÓDIGO do ponto vem do navegador; o endereço e os horários que ficam
   * gravados no pedido são montados aqui, a partir da lista do servidor. Se
   * viessem prontos da tela, daria pra gravar qualquer endereço no pedido.
   */
  let pontoRetirada: string | null = null;
  if (tipoEntrega === "retirada") {
    const pontos = pontosDaLoja((await getConfigLoja()).pontosRetirada);
    const ponto = pontoRetiradaPorId(pontos, texto(body.pontoRetirada, 40));
    if (!ponto) {
      return NextResponse.json(
        { error: "Escolha onde você prefere buscar o pedido." },
        { status: 400 }
      );
    }
    pontoRetirada = descricaoDoPonto(ponto);
  }

  // 4b) Quando o pedido precisa estar pronto. Nos dois casos é a data da
  // compra mais o tempo de encomenda: a cliente não marca mais dia nem hora
  // no site — isso ela combina com a Camily pelo WhatsApp.
  const agora = new Date();
  const prazoEm = dataMinimaRetirada(prazoDias, agora);

  // 5) Cupom de desconto, se o cliente informou. A regra e o valor saem do
  // banco: o desconto que vier do navegador é ignorado.
  const subtotal = itens.reduce((a, i) => a + i.precoUnitario * i.quantidade, 0);
  let desconto = 0;
  let cupomCodigo: string | null = null;
  /** Cupom de Pix: a cobrança tem que sair em Pix, e só. */
  let obrigarPix = false;

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
    obrigarPix = r.cupom.somentePix;
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
    // Ninguém agenda dia e hora pelo site: quem combina é a Camily.
    dataAgendada: "",
    pontoRetirada,
    prazoEm,
    // Endereço congelado no momento da compra — se a cliente mudar de casa
    // depois, o pedido antigo mantém o endereço certo.
    enderecoEntrega: tipoEntrega === "entrega" ? enderecoDestino : null,
    ehPresente,
    nomeQuemRecebe: ehPresente ? texto(body.nomeQuemRecebe, 120) || null : null,
    bilhete: texto(body.bilhete, 500) || null,
    valorFrete,
    cupomCodigo,
    desconto,
    // Com cupom de Pix a cobrança sai obrigatoriamente em Pix, então é isso
    // que fica gravado — senão as métricas descontariam a taxa do crédito.
    formaPagamento: obrigarPix ? "pix" : body.formaPagamento ?? "pix",
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

  // 8) Cria a preferência de pagamento no Mercado Pago. A montagem fica em
  // `lib/preferencia-mp.ts`, compartilhada com a retomada do pagamento.
  const origin = req.headers.get("origin") ?? new URL(req.url).origin;

  const url = await criarPreferenciaDoPedido(client, {
    pedidoId: id,
    itens,
    valorFrete,
    desconto,
    cupomCodigo,
    comprador: {
      nome: cliente.nome,
      email: cliente.email,
      telefone: cliente.telefone,
    },
    origin,
    obrigarPix,
  });

  return NextResponse.json({
    pedidoId: id,
    url,
  });
}
