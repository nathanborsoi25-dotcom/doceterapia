import { PaymentRefund } from "mercadopago";
import { eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import { cupons, pedidos, pontos } from "./db/schema";
import { getMpClient } from "./mercadopago";
import { avisarMudancaDeStatus } from "./avisar-cliente";
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
 * Manda o Mercado Pago devolver o valor inteiro do pagamento.
 *
 * Devolve `false` quando não deu — e aí o pedido é cancelado do mesmo jeito,
 * mas fica marcado pra Camily estornar na mão. Prender o cancelamento num
 * erro de rede deixaria o cliente esperando sem resposta.
 */
async function estornarNoMercadoPago(
  pagamentoId: string
): Promise<{ ok: boolean; valor: number }> {
  const client = getMpClient();
  if (!client) return { ok: false, valor: 0 };

  try {
    const refund = new PaymentRefund(client);
    const r = await refund.total({ payment_id: pagamentoId });
    // O MP responde "approved" na hora no Pix; no cartão pode vir
    // "in_process" e ele conclui sozinho depois. Os dois contam como aceito.
    const aceito = r.status === "approved" || r.status === "in_process";
    return { ok: aceito, valor: r.amount ?? 0 };
  } catch (e) {
    console.error("Mercado Pago recusou o estorno:", e);
    return { ok: false, valor: 0 };
  }
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
  opcoes: { por: QuemCancelou; motivo?: string; clienteId?: string }
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

  // 1) Dinheiro primeiro: só faz sentido estornar o que entrou.
  let reembolso: StatusReembolso = "nao_precisa";
  let valorReembolsado = 0;

  if (jaFoiPago(status)) {
    if (!pedido.pagamentoId) {
      // Pedido pago antes de existir este campo, ou pagamento fora do site.
      reembolso = "falhou";
    } else {
      const r = await estornarNoMercadoPago(pedido.pagamentoId);
      reembolso = r.ok ? "concluido" : "falhou";
      valorReembolsado = r.ok ? r.valor : 0;
    }
  }

  // 2) O pedido é cancelado mesmo se o estorno falhar — a decisão de cancelar
  // já foi tomada. O "falhou" fica gravado e aparece em vermelho no painel,
  // com um botão pra tentar de novo.
  await db
    .update(pedidos)
    .set({
      status: "cancelado",
      canceladoPor: opcoes.por,
      motivoCancelamento: (opcoes.motivo ?? "").slice(0, 300) || null,
      canceladoEm: new Date(),
      statusReembolso: reembolso,
      valorReembolsado,
    })
    .where(eq(pedidos.id, pedidoId));

  // 3) Desfaz o que a compra tinha rendido.
  if (pedido.clienteId) await estornarPontosDoPedido(pedidoId, pedido.clienteId);
  if (pedido.cupomCodigo) await liberarUsoDoCupom(pedido.cupomCodigo);

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

  await db
    .update(pedidos)
    .set({
      status: "cancelado",
      canceladoPor: "loja",
      canceladoEm: new Date(),
      motivoCancelamento: "Cancelado pelo Mercado Pago",
      statusReembolso: opcoes.reembolsado ? "concluido" : "nao_precisa",
    })
    .where(eq(pedidos.id, pedidoId));

  if (pedido.clienteId) await estornarPontosDoPedido(pedidoId, pedido.clienteId);
  if (pedido.cupomCodigo) await liberarUsoDoCupom(pedido.cupomCodigo);
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
