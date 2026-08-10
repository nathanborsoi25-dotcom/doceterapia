import { PaymentRefund } from "mercadopago";
import { and, eq, ne, sql } from "drizzle-orm";
import { getDb } from "./db";
import { cupons, pedidos, pontos } from "./db/schema";
import { getMpClient } from "./mercadopago";
import { avisarMudancaDeStatus } from "./avisar-cliente";
import { devolverAoEstoque } from "./estoque";
import type { StatusPedido } from "./types";

/**
 * Cancelamento de pedido, com devolução do dinheiro.
 *
 * Fica num arquivo só porque duas portas levam aqui — o cliente cancelando
 * pela conta dele e a Camily cancelando pelo painel — e as duas precisam
 * fazer exatamente a mesma coisa: estornar no Mercado Pago, tirar os pontos
 * que aquela compra deu, liberar o uso do cupom e avisar por e-mail.
 */

export type QuemCancelou = "cliente" | "loja";

/** Situação da devolução do dinheiro, como fica gravada no pedido. */
export type StatusReembolso = "nao_precisa" | "concluido" | "falhou";

/**
 * Até onde o CLIENTE cancela sozinho. Depois que a Camily começou a fazer os
 * doces, os ingredientes já foram usados — daí em diante o cancelamento passa
 * por ela, pelo WhatsApp.
 */
export function clientePodeCancelar(status: StatusPedido): boolean {
  return status === "aguardando_pagamento" || status === "pago";
}

/** Situações em que o dinheiro já entrou e, portanto, precisa voltar. */
function jaFoiPago(status: StatusPedido): boolean {
  return (
    status === "pago" ||
    status === "em_preparo" ||
    status === "a_caminho" ||
    status === "concluido"
  );
}

export type ResultadoCancelamento =
  | { ok: true; reembolso: StatusReembolso; valorReembolsado: number }
  | { ok: false; erro: string };

/**
 * Manda o Mercado Pago devolver o dinheiro.
 *
 * Sem `valor`, devolve o pagamento inteiro — doces e frete. Com `valor`,
 * devolve só aquela parte: é o caso de "devolvo os doces mas não o frete,
 * porque o entregador já rodou". Quem escolhe é a Camily, no painel.
 *
 * Devolve `false` quando não deu — e aí o pedido é cancelado do mesmo jeito,
 * mas fica marcado pra Camily estornar na mão. Prender o cancelamento num
 * erro de rede deixaria o cliente esperando sem resposta.
 */
async function estornarNoMercadoPago(
  pagamentoId: string,
  valor?: number
): Promise<{ ok: boolean; valor: number }> {
  const client = getMpClient();
  if (!client) return { ok: false, valor: 0 };

  try {
    const refund = new PaymentRefund(client);
    const parcial = typeof valor === "number" && valor > 0;
    const r = parcial
      ? await refund.create({
          payment_id: pagamentoId,
          body: { amount: Math.round(valor * 100) / 100 },
        })
      : await refund.total({ payment_id: pagamentoId });
    // O MP responde "approved" na hora no Pix; no cartão pode vir
    // "in_process" e ele conclui sozinho depois. Os dois contam como aceito.
    const aceito = r.status === "approved" || r.status === "in_process";
    return { ok: aceito, valor: r.amount ?? 0 };
  } catch (e) {
    console.error("Mercado Pago recusou o estorno:", e);
    return { ok: false, valor: 0 };
  }
}

/**
 * O que o pedido cobrou de verdade: doces mais frete, menos o cupom. É o teto
 * do que dá pra devolver.
 */
export function totalDoPedido(pedido: {
  itens: unknown;
  valorFrete: number;
  desconto: number;
}): number {
  const itens = (pedido.itens ?? []) as Array<{
    precoUnitario: number;
    quantidade: number;
  }>;
  const subtotal = itens.reduce(
    (a, i) => a + (i.precoUnitario ?? 0) * (i.quantidade ?? 0),
    0
  );
  return Math.max(0, subtotal + pedido.valorFrete - pedido.desconto);
}

/** Tira do extrato os pontos que a compra tinha dado. */
async function estornarPontosDoPedido(pedidoId: string, clienteId: string) {
  const db = getDb();
  const [linha] = await db
    .select({ total: sql<number>`coalesce(sum(${pontos.quantidade}), 0)::int` })
    .from(pontos)
    .where(eq(pontos.pedidoId, pedidoId));

  // Soma o que aquele pedido movimentou. Se já está zerado, o estorno já foi
  // feito antes — chamar de novo não pode deixar o cliente com saldo negativo.
  const total = linha?.total ?? 0;
  if (total <= 0) return;

  await db.insert(pontos).values({
    id: crypto.randomUUID(),
    clienteId,
    quantidade: -total,
    motivo: "estorno",
    descricao: "Pedido cancelado",
    pedidoId,
  });
}

/** Devolve o uso do cupom, pra ele não ficar "gasto" por uma compra desfeita. */
async function liberarUsoDoCupom(codigo: string) {
  await getDb()
    .update(cupons)
    .set({ usos: sql`greatest(${cupons.usos} - 1, 0)` })
    .where(eq(cupons.codigo, codigo));
}

export async function cancelarPedido(
  pedidoId: string,
  opcoes: {
    por: QuemCancelou;
    motivo?: string;
    clienteId?: string;
    /**
     * Quanto devolver. Só a Camily escolhe: quando o cancelamento vem da
     * cliente, a devolução é sempre integral. Ausente = valor inteiro.
     */
    valorReembolso?: number;
  }
): Promise<ResultadoCancelamento> {
  const db = getDb();

  const [pedido] = await db.select().from(pedidos).where(eq(pedidos.id, pedidoId));
  if (!pedido) return { ok: false, erro: "Pedido não encontrado." };

  // Quando quem pede é o cliente, o pedido precisa ser dele mesmo. Sem isso,
  // saber o número de um pedido bastaria pra cancelar a compra de outra pessoa.
  if (opcoes.clienteId && pedido.clienteId !== opcoes.clienteId) {
    return { ok: false, erro: "Pedido não encontrado." };
  }

  const status = pedido.status as StatusPedido;
  if (status === "cancelado") {
    return {
      ok: true,
      reembolso: (pedido.statusReembolso as StatusReembolso) ?? "nao_precisa",
      valorReembolsado: pedido.valorReembolsado ?? 0,
    };
  }

  if (opcoes.por === "cliente" && !clientePodeCancelar(status)) {
    return {
      ok: false,
      erro:
        "Este pedido já está sendo preparado, então o cancelamento passa pela Camily. Chame ela no WhatsApp que ela resolve com você.",
    };
  }

  /**
   * 1) Marca como cancelado ANTES de mexer no dinheiro, com a condição dentro
   * do próprio update.
   *
   * Essa ordem é de propósito: é o que garante que dois cliques no botão
   * (ou a cliente cancelando enquanto a Camily cancela) não peçam DOIS
   * estornos do mesmo pagamento nem devolvam o estoque duas vezes. Quem não
   * encontra linha pra alterar já perdeu a corrida e sai com o que está
   * gravado.
   */
  const mudou = await db
    .update(pedidos)
    .set({
      status: "cancelado",
      canceladoPor: opcoes.por,
      motivoCancelamento: (opcoes.motivo ?? "").slice(0, 300) || null,
      canceladoEm: new Date(),
    })
    .where(and(eq(pedidos.id, pedidoId), ne(pedidos.status, "cancelado")))
    .returning({ id: pedidos.id });

  if (mudou.length === 0) {
    const [agora] = await db.select().from(pedidos).where(eq(pedidos.id, pedidoId));
    return {
      ok: true,
      reembolso: (agora?.statusReembolso as StatusReembolso) ?? "nao_precisa",
      valorReembolsado: agora?.valorReembolsado ?? 0,
    };
  }

  // 2) Agora o dinheiro: só faz sentido estornar o que entrou. O pedido já
  // está cancelado mesmo se o estorno falhar — a decisão de cancelar já foi
  // tomada. O "falhou" fica gravado e aparece em vermelho no painel, com um
  // botão pra tentar de novo.
  let reembolso: StatusReembolso = "nao_precisa";
  let valorReembolsado = 0;

  if (jaFoiPago(status)) {
    /*
     * Quanto devolver. Só a loja escolhe: cancelamento vindo da cliente
     * devolve sempre o valor inteiro. O valor é preso entre zero e o total
     * do pedido, pra ninguém devolver mais do que entrou.
     */
    const total = totalDoPedido(pedido);
    const escolhaDaLoja = opcoes.por === "loja" ? opcoes.valorReembolso : undefined;
    const aDevolver =
      typeof escolhaDaLoja === "number"
        ? Math.min(Math.max(escolhaDaLoja, 0), total)
        : total;

    if (aDevolver <= 0) {
      /*
       * "Não devolver nada" é uma decisão, não uma falha — vem antes de
       * olhar o pagamento. Marcar "falhou" aqui deixaria um alerta vermelho
       * no painel pedindo pra ela estornar justamente o que ela decidiu não
       * estornar.
       */
      reembolso = "nao_precisa";
    } else if (!pedido.pagamentoId) {
      // Pedido pago antes de existir este campo, ou pagamento fora do site.
      reembolso = "falhou";
    } else {
      const r = await estornarNoMercadoPago(
        pedido.pagamentoId,
        // Sem valor = estorno total; com valor = parcial.
        aDevolver < total ? aDevolver : undefined
      );
      reembolso = r.ok ? "concluido" : "falhou";
      valorReembolsado = r.ok ? r.valor : 0;
    }
  }

  await db
    .update(pedidos)
    .set({ statusReembolso: reembolso, valorReembolsado })
    .where(eq(pedidos.id, pedidoId));

  // 3) Desfaz o que a compra tinha rendido.
  if (pedido.clienteId) await estornarPontosDoPedido(pedidoId, pedido.clienteId);
  if (pedido.cupomCodigo) await liberarUsoDoCupom(pedido.cupomCodigo);
  // Os doces voltam pra prateleira — mas só se tinham saído dela, o que
  // acontece na confirmação do pagamento.
  if (jaFoiPago(status)) await devolverAoEstoque(pedido.itens);

  // 4) Avisa o cliente. Nunca lança erro — o cancelamento já está feito.
  await avisarMudancaDeStatus(pedidoId, "cancelado");

  return { ok: true, reembolso, valorReembolsado };
}

/**
 * Cancelamento que veio de FORA do site: a Camily estornou ou cancelou o
 * pagamento direto no painel do Mercado Pago, e ficamos sabendo pelo webhook.
 *
 * Aqui não se pede estorno nenhum — ele já aconteceu lá. O que falta é o
 * resto: tirar os pontos, liberar o cupom e avisar a cliente. Sem isso, um
 * estorno feito pelo site do MP deixaria o pedido "cancelado" mas com os
 * pontos da compra ainda no saldo dela.
 */
export async function registrarCancelamentoDoMercadoPago(
  pedidoId: string,
  opcoes: { reembolsado: boolean }
): Promise<void> {
  const db = getDb();
  const [pedido] = await db.select().from(pedidos).where(eq(pedidos.id, pedidoId));
  if (!pedido || pedido.status === "cancelado") return;

  /**
   * A condição vai DENTRO do update, e não numa leitura feita antes: o
   * Mercado Pago repete a mesma notificação, e duas chegando juntas
   * conseguiam passar as duas pela checagem acima — o estoque voltava em
   * dobro e os pontos eram estornados duas vezes. Só quem encontra a linha
   * pra alterar segue adiante.
   */
  const mudou = await db
    .update(pedidos)
    .set({
      status: "cancelado",
      canceladoPor: "loja",
      canceladoEm: new Date(),
      motivoCancelamento: "Cancelado pelo Mercado Pago",
      statusReembolso: opcoes.reembolsado ? "concluido" : "nao_precisa",
    })
    .where(and(eq(pedidos.id, pedidoId), ne(pedidos.status, "cancelado")))
    .returning({ id: pedidos.id });

  if (mudou.length === 0) return;

  if (pedido.clienteId) await estornarPontosDoPedido(pedidoId, pedido.clienteId);
  if (pedido.cupomCodigo) await liberarUsoDoCupom(pedido.cupomCodigo);
  if (jaFoiPago(pedido.status as StatusPedido)) {
    await devolverAoEstoque(pedido.itens);
  }
  await avisarMudancaDeStatus(pedidoId, "cancelado");
}

/**
 * Pagamento que caiu DEPOIS do pedido já ter sido cancelado.
 *
 * Acontece de verdade: o link de pagamento do Mercado Pago continua vivo,
 * então a cliente pode cancelar pelo site e pagar o Pix logo em seguida, sem
 * perceber. Nesse caso o dinheiro entrou por engano — devolvemos na hora e o
 * pedido continua cancelado.
 */
export async function devolverPagamentoDePedidoCancelado(
  pedidoId: string,
  pagamentoId: string
): Promise<void> {
  const db = getDb();
  const r = await estornarNoMercadoPago(pagamentoId);
  await db
    .update(pedidos)
    .set({
      pagamentoId,
      statusReembolso: r.ok ? "concluido" : "falhou",
      valorReembolsado: r.ok ? r.valor : 0,
    })
    .where(eq(pedidos.id, pedidoId));
}

/**
 * Nova tentativa de estorno, para quando o Mercado Pago recusou na hora do
 * cancelamento. Fica no painel da Camily, pra ela não precisar entrar no site
 * do MP quando foi só um tropeço de conexão.
 */
export async function tentarEstornoDeNovo(
  pedidoId: string
): Promise<ResultadoCancelamento> {
  const db = getDb();
  const [pedido] = await db.select().from(pedidos).where(eq(pedidos.id, pedidoId));

  if (!pedido) return { ok: false, erro: "Pedido não encontrado." };
  if (pedido.status !== "cancelado") {
    return { ok: false, erro: "O pedido precisa estar cancelado." };
  }
  if (pedido.statusReembolso === "concluido") {
    return { ok: true, reembolso: "concluido", valorReembolsado: pedido.valorReembolsado ?? 0 };
  }
  if (!pedido.pagamentoId) {
    return {
      ok: false,
      erro:
        "Este pedido não tem pagamento registrado no Mercado Pago — se o cliente pagou, devolva por fora (Pix) e marque com ele.",
    };
  }

  const r = await estornarNoMercadoPago(pedido.pagamentoId);
  await db
    .update(pedidos)
    .set({
      statusReembolso: r.ok ? "concluido" : "falhou",
      valorReembolsado: r.ok ? r.valor : 0,
    })
    .where(eq(pedidos.id, pedidoId));

  return r.ok
    ? { ok: true, reembolso: "concluido", valorReembolsado: r.valor }
    : {
        ok: false,
        erro: "O Mercado Pago recusou o estorno de novo. Faça pelo site deles.",
      };
}
