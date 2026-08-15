import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  carrinhos,
  configFrete,
  cupons,
  pedidos,
  produtos,
  recompensas,
  sabores,
} from "@/lib/db/schema";
import {
  creditarPontosDoPedido,
  debitarResgatesDoPedido,
  saldoDePontos,
} from "@/lib/fidelidade";
import { faltaDocePago, nadaACobrar, PREFIXO_RESGATE } from "@/lib/resgate";
import { avisarMudancaDeStatus } from "@/lib/avisar-cliente";
import { avisarLojaDeVendaPaga } from "@/lib/avisar-loja";
import { getClienteLogado } from "@/lib/cliente-logado";
import { getMpClient } from "@/lib/mercadopago";
import { calcularFretePorEndereco, configuracaoFretePadrao } from "@/lib/shipping";
import { checarAreaEntrega } from "@/lib/area-entrega";
import { geocodificar } from "@/lib/geocode";
import { dataMinimaRetirada, prazoMaximoEmDias } from "@/lib/prazo";
import { descricaoDoPonto, pontoRetiradaPorId, pontosDaLoja } from "@/lib/retirada";
import { getConfigLoja } from "@/lib/config-loja";
import { avaliarCupom, normalizarCodigo } from "@/lib/cupom";
import { descontoDoPix } from "@/lib/desconto-pix";
import { avisoDeFechada, lojaAberta } from "@/lib/funcionamento";
import { baixarEstoque, conferirEstoque, mensagemDeFalta } from "@/lib/estoque";
import { criarPreferenciaDoPedido } from "@/lib/preferencia-mp";
import { precoAPagar, precoCheio, subtotalQueAceitaCupom } from "@/lib/promocao";
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

  /*
   * 0) Loja fechada não fecha pedido — e essa é a PRIMEIRA coisa conferida,
   * antes de olhar carrinho, endereço ou estoque: é o motivo mais importante
   * da recusa, e não faz sentido reclamar de um doce esgotado para quem só
   * vai poder comprar amanhã de manhã.
   *
   * A checagem é aqui, no servidor, e não só na tela: o aviso some da frente
   * de quem está com a página aberta desde antes de fechar, e o botão dela
   * continuaria funcionando.
   */
  const configLoja = await getConfigLoja();
  if (!lojaAberta(configLoja.funcionamento)) {
    return NextResponse.json(
      { error: avisoDeFechada(configLoja.funcionamento) },
      { status: 409 }
    );
  }

  /*
   * 1) Prêmios de pontos e doces são separados aqui.
   *
   * O prêmio não está no cardápio: ele vale R$ 0,00 e sai do saldo de pontos.
   * O que o navegador manda sobre ele — nome, preço, quantos pontos custa — é
   * descartado do mesmo jeito que o preço de um doce: tudo é remontado a
   * partir da tabela de recompensas, mais abaixo.
   */
  const resgatesRecebidos = recebidos.filter((i) => i?.recompensaId);
  const docesRecebidos = recebidos.filter((i) => !i?.recompensaId);

  // 1b) Remonta os itens A PARTIR DO BANCO. Nome e preço que vêm do navegador
  // são descartados — só o produtoId e a quantidade são aproveitados —, senão
  // dava pra comprar uma torta de R$ 65,00 por R$ 1,00.
  const ids = Array.from(
    new Set(docesRecebidos.map((i) => i?.produtoId).filter(Boolean) as string[])
  );
  if (ids.length === 0 && resgatesRecebidos.length === 0) {
    return NextResponse.json({ error: "Carrinho inválido." }, { status: 400 });
  }

  const doBanco = ids.length
    ? await db.select().from(produtos).where(inArray(produtos.id, ids))
    : [];
  const porId = new Map(doBanco.map((p) => [p.id, p]));

  // Os recheios também saem do banco: o preço de um sabor é tão forjável
  // quanto o do doce se vier do navegador.
  const recheios = ids.length
    ? await db.select().from(sabores).where(inArray(sabores.produtoId, ids))
    : [];
  const saborPorId = new Map(recheios.map((s) => [s.id, s]));

  const itens: ItemPedido[] = [];
  for (const recebido of docesRecebidos) {
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

    /*
     * O preço sai do banco, e a promoção também. O que vem do navegador não
     * decide nada aqui — nem o preço cheio, nem se o doce está em oferta —,
     * senão dava pra forjar uma promoção que não existe.
     */
    const cheio = precoCheio(produto, sabor);
    const aPagar = precoAPagar(produto, sabor);

    itens.push({
      produtoId: produto.id,
      nome: produto.nome,
      precoUnitario: aPagar,
      quantidade,
      saborId: sabor?.id,
      saborNome: sabor?.nome,
      // Guardado no item porque é o que decide se o cupom encosta nele, e
      // porque o pedido precisa continuar legível depois que a oferta acabar.
      emPromocao: aPagar < cheio,
      precoCheio: aPagar < cheio ? cheio : undefined,
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

  /*
   * 2b) Os prêmios trocados por pontos.
   *
   * Tudo é remontado do banco: a recompensa precisa existir, estar ativa, e o
   * custo em pontos é o que está gravado NELA — não o que o navegador disse.
   * Sem isso dava pra pedir um prêmio de 500 pontos jurando que custa 1.
   *
   * O saldo é conferido AQUI, e de novo, mesmo que a tela já tenha conferido:
   * entre montar o carrinho e pagar, a cliente pode ter gasto os pontos em
   * outro pedido. Os pontos só saem do extrato quando o pagamento é
   * confirmado (no webhook) — aqui é só a checagem.
   */
  let pontosGastos = 0;
  if (resgatesRecebidos.length > 0) {
    const idsResgate = Array.from(
      new Set(resgatesRecebidos.map((i) => i!.recompensaId!).filter(Boolean))
    );
    const premios = await db
      .select()
      .from(recompensas)
      .where(inArray(recompensas.id, idsResgate));
    const premioPorId = new Map(premios.map((r) => [r.id, r]));

    // Prêmio repetido não passa: um resgate, uma unidade.
    const jaVistos = new Set<string>();

    for (const recebido of resgatesRecebidos) {
      const premio = premioPorId.get(recebido!.recompensaId!);
      if (!premio || !premio.ativo) {
        return NextResponse.json(
          { error: "Um dos prêmios do seu carrinho não está mais disponível." },
          { status: 400 }
        );
      }
      if (jaVistos.has(premio.id)) {
        return NextResponse.json(
          { error: `Você só pode resgatar um ${premio.nome} por pedido.` },
          { status: 400 }
        );
      }
      jaVistos.add(premio.id);

      pontosGastos += premio.pontos;
      itens.push({
        produtoId: `${PREFIXO_RESGATE}${premio.id}`,
        nome: premio.nome,
        precoUnitario: 0,
        quantidade: 1,
        recompensaId: premio.id,
        pontosGastos: premio.pontos,
      });
    }

    const saldo = await saldoDePontos(cliente.id);
    if (saldo < pontosGastos) {
      return NextResponse.json(
        {
          error: `Você tem ${saldo} ${saldo === 1 ? "ponto" : "pontos"}, e os prêmios do carrinho custam ${pontosGastos}. Tire um prêmio para continuar.`,
        },
        { status: 400 }
      );
    }

    /*
     * O prêmio vai junto com uma compra, nunca sozinho — vale para entrega e
     * para retirada. A tela já avisa antes de chegar aqui; esta é a trava que
     * vale, porque o carrinho vem do navegador.
     */
    if (faltaDocePago(itens)) {
      return NextResponse.json(
        {
          error:
            "O prêmio vai junto com um pedido. Escolha pelo menos um doce para levar com ele. 🍒",
        },
        { status: 400 }
      );
    }
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

  /*
   * 3) A tabela de frete da loja, e a conferência de que dá pra entregar
   * neste endereço.
   *
   * O VALOR do frete só é fechado lá embaixo, depois do cupom: o frete grátis
   * olha quanto a cliente paga em doces já com o desconto aplicado. Aqui a
   * gente só garante que o endereço tem coordenadas e cai dentro de alguma
   * faixa — as duas coisas que podem recusar a compra.
   */
  let configDoFrete = configuracaoFretePadrao;
  if (tipoEntrega === "entrega") {
    const [linhaCfg] = await db
      .select()
      .from(configFrete)
      .where(eq(configFrete.id, "default"));
    if (linhaCfg) {
      configDoFrete = {
        origem: linhaCfg.origem,
        origemFimDeSemana: linhaCfg.origemFimDeSemana ?? null,
        freteGratisAcimaDe: linhaCfg.freteGratisAcimaDe ?? 0,
        faixas: linhaCfg.faixas,
      };
    }

    const { lat, lng } = enderecoDestino;

    if (lat == null || lng == null) {
      return NextResponse.json(
        { error: "Não foi possível calcular o frete para o seu endereço." },
        { status: 400 }
      );
    }

    // Sem `valorEmDoces`: aqui interessa só se o endereço cai em alguma faixa.
    if (calcularFretePorEndereco(lat, lng, configDoFrete).valor === null) {
      return NextResponse.json(
        {
          error:
            "Não é possível concluir a compra com entrega: seu endereço está distante demais. Escolha Retirada ou fale com a Camily pelo WhatsApp.",
        },
        { status: 400 }
      );
    }
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
    const pontos = pontosDaLoja(configLoja.pontosRetirada);
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

  /*
   * Qual botão de pagar a pessoa apertou. Fica aqui em cima porque o cupom
   * também olha pra isso (existe cupom antigo que só valia no Pix), e a
   * cobrança sai travada nesta forma — ver `lib/preferencia-mp.ts`.
   */
  const formaPagamento = body.formaPagamento === "credito" ? "credito" : "pix";

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
    // A base do desconto é o carrinho SEM os doces em promoção — e ela é
    // calculada aqui, a partir dos itens que o servidor remontou.
    const r = avaliarCupom(
      cupom,
      subtotal,
      cliente.id,
      formaPagamento,
      subtotalQueAceitaCupom(itens)
    );
    if (!r.valido) {
      return NextResponse.json({ error: r.motivo }, { status: 400 });
    }
    desconto = r.desconto;
    cupomCodigo = r.cupom.codigo;
  }

  /*
   * 5b) Agora sim, o valor do frete.
   *
   * O frete grátis olha o subtotal em DOCES, **antes do cupom** — quem juntou
   * os R$ 60 não perde a entrega por usar um desconto que a loja mesma deu.
   * O valor que o navegador mandou continua sendo ignorado por completo: esta
   * conta é refeita aqui, a partir do banco.
   *
   * De onde a entrega sai depende do dia da semana (fim de semana tem
   * endereço próprio), e quem decide isso é `origemDoDia`, no fuso de
   * Brasília. A conferência de área já foi feita lá em cima.
   */
  let valorFrete = 0;
  if (tipoEntrega === "entrega") {
    const { lat, lng } = enderecoDestino;
    const calculo = calcularFretePorEndereco(lat!, lng!, configDoFrete, {
      valorEmDoces: subtotal,
    });
    // Não deveria acontecer (a área já foi conferida), mas deixar passar
    // gravaria um pedido de entrega com frete R$ 0,00 — e o prejuízo seria da
    // Camily, calado.
    if (calculo.valor === null) {
      return NextResponse.json(
        { error: "Não foi possível calcular o frete para o seu endereço." },
        { status: 400 }
      );
    }
    valorFrete = calculo.valor;
  }

  /*
   * 5c) Desconto de quem paga no Pix. O percentual vem da configuração da
   * loja, nunca do navegador. Vale em TUDO, inclusive nos doces em promoção:
   * ele não é desconto de verdade, é a diferença de taxa que a Camily deixa
   * de pagar ao receber no Pix.
   */
  const descontoPix = descontoDoPix(
    formaPagamento,
    Math.max(0, subtotal - desconto + valorFrete),
    configLoja.descontoPix
  );

  /*
   * 5d) Tem o que cobrar?
   *
   * Um pedido só de prêmio, retirado na mão da Camily, soma **R$ 0,00** — e o
   * Mercado Pago recusa cobrança de zero. A resposta antiga era recusar o
   * pedido e mandar a cliente juntar um doce; ou seja, o prêmio que ela levou
   * meses juntando só saía se ela comprasse outra coisa. Agora esse pedido
   * pula o gateway inteiro e já nasce pago, porque não há nada a receber.
   *
   * Quem decide é `nadaACobrar`, a mesma função que a tela do checkout usa
   * para trocar os botões de pagar por um de confirmar.
   */
  const totalACobrar = Math.max(0, subtotal - desconto + valorFrete - descontoPix);
  const semCobranca = nadaACobrar(totalACobrar);

  // 6) Só agora precisamos do Mercado Pago — as validações acima já
  // recusaram o que não dá pra vender, sem depender do gateway. Pedido sem
  // cobrança nem chega aqui: ele não abre tela de pagamento nenhuma.
  const client = semCobranca ? null : getMpClient();
  if (!semCobranca && !client) {
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
    descontoPix,
    // A cobrança sai travada nesta forma, então é ela que fica gravada — é o
    // que as métricas usam pra saber qual taxa o Mercado Pago cobrou.
    formaPagamento,
    // Sem nada a cobrar, não existe "aguardando pagamento": o pedido já entra
    // na fila da Camily como qualquer venda paga.
    status: semCobranca ? "pago" : "aguardando_pagamento",
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

  /*
   * 7b) Pedido sem cobrança: o que o webhook faria, feito aqui.
   *
   * Quem confirma uma venda normal é a notificação do Mercado Pago. Como esta
   * não passa por lá, notificação nenhuma vai chegar — e sem isto o prêmio
   * sairia sem descontar ponto, sem baixar estoque e sem a Camily saber que
   * existe um pedido pra preparar.
   *
   * A ordem é a mesma do webhook. `creditarPontosDoPedido` entra por simetria:
   * com valor pago zero ela não lança nada, e deixá-la aqui evita que um
   * pedido de cupom de 100% (também sem cobrança) fique sem os pontos no dia
   * em que a regra mudar.
   */
  if (semCobranca) {
    /*
     * O débito dos pontos vem primeiro — é o que a loja tem a perder. Se
     * qualquer uma dessas escritas falhar, o pedido é desfeito inteiro, do
     * mesmo jeito que quando o Mercado Pago recusa a preferência: melhor a
     * cliente tentar de novo do que ficar com o prêmio sem gastar ponto, ou
     * com o ponto gasto sem pedido.
     */
    try {
      await debitarResgatesDoPedido(cliente.id, id, itens);
      await baixarEstoque(itens);
      await creditarPontosDoPedido(cliente.id, id, Math.max(0, subtotal - desconto));
    } catch (e) {
      console.error("Falha ao confirmar pedido sem cobrança:", e);

      await db.delete(pedidos).where(eq(pedidos.id, id));
      if (cupomCodigo) {
        await db
          .update(cupons)
          .set({ usos: sql`greatest(${cupons.usos} - 1, 0)` })
          .where(eq(cupons.codigo, cupomCodigo));
      }

      return NextResponse.json(
        {
          error:
            "Não consegui confirmar seu resgate agora. Seus pontos continuam com você — tente de novo em instantes.",
        },
        { status: 500 }
      );
    }

    // Os avisos ficam por último e não derrubam nada: eles já engolem os
    // próprios erros, e um e-mail que não saiu não desfaz um prêmio válido.
    await avisarMudancaDeStatus(id, "pago");
    await avisarLojaDeVendaPaga(id);

    return NextResponse.json({ pedidoId: id, url: null, semCobranca: true });
  }

  // 8) Cria a preferência de pagamento no Mercado Pago. A montagem fica em
  // `lib/preferencia-mp.ts`, compartilhada com a retomada do pagamento.
  const origin = req.headers.get("origin") ?? new URL(req.url).origin;

  // Não acontece: o pedido sem cobrança já respondeu lá em cima, e sem
  // Mercado Pago configurado a rota parou antes de gravar. A guarda existe
  // para quem mexer na ordem depois — e para o TypeScript.
  if (!client) {
    return NextResponse.json(
      { error: "Pagamento ainda não configurado." },
      { status: 503 }
    );
  }

  let url: string | null = null;
  try {
    url = await criarPreferenciaDoPedido(client, {
      pedidoId: id,
      itens,
      valorFrete,
      desconto,
      descontoPix,
      cupomCodigo,
      comprador: {
        nome: cliente.nome,
        email: cliente.email,
        telefone: cliente.telefone,
      },
      origin,
      formaPagamento,
    });
  } catch (e) {
    /*
     * O Mercado Pago recusou a preferência.
     *
     * O pedido já está gravado a esta altura, e sem desfazer isso cada
     * tentativa deixaria um pedido fantasma em "aguardando pagamento" no
     * painel da Camily — foi o que aconteceu quando um valor inválido em
     * `excluded_payment_types` derrubou o Checkout: o site respondia 500 e o
     * painel enchia de pedidos que ninguém fez.
     *
     * Então desfazemos tudo o que a criação mexeu: o pedido sai, o uso do
     * cupom volta, e o carrinho continua no navegador do cliente pra ele
     * tentar de novo.
     */
    console.error("Mercado Pago recusou a preferência:", e);

    await db.delete(pedidos).where(eq(pedidos.id, id));
    if (cupomCodigo) {
      await db
        .update(cupons)
        .set({ usos: sql`greatest(${cupons.usos} - 1, 0)` })
        .where(eq(cupons.codigo, cupomCodigo));
    }

    return NextResponse.json(
      {
        error:
          "Não consegui abrir a tela de pagamento agora. Seu carrinho está guardado — tente de novo em instantes, e se continuar assim me chame no WhatsApp.",
        // Ajuda a achar o motivo sem depender do log da Vercel.
        detalhe: e instanceof Error ? e.message.slice(0, 300) : String(e).slice(0, 300),
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    pedidoId: id,
    url,
  });
}
