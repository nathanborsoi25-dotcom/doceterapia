import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { clientes, pedidos } from "./db/schema";
import {
  emailDaLoja,
  emailPedidoCancelado,
  emailVendaNova,
  enviarEmail,
} from "./email";

/**
 * Avisa a Camily, por e-mail, que entrou uma venda paga.
 *
 * Nunca lança erro. Este aviso é conveniência: o pedido já está pago e
 * gravado, e derrubar o webhook do Mercado Pago por causa de um e-mail faria
 * o MP reenviar a notificação inteira — justamente o caminho que já creditou
 * pontos em dobro uma vez.
 */
export async function avisarLojaDeVendaPaga(pedidoId: string): Promise<void> {
  try {
    const para = emailDaLoja();
    if (!para) return; // sem endereço configurado, não há o que fazer

    const db = getDb();
    const [linha] = await db
      .select({ pedido: pedidos, cliente: clientes })
      .from(pedidos)
      .leftJoin(clientes, eq(pedidos.clienteId, clientes.id))
      .where(eq(pedidos.id, pedidoId));

    if (!linha) return;
    const { pedido, cliente } = linha;

    // O total que ela recebe: doces menos os descontos, mais o frete. É o
    // mesmo valor que o Mercado Pago cobrou.
    const subtotal = pedido.itens.reduce(
      (a, i) => a + i.precoUnitario * i.quantidade,
      0
    );
    const total = Math.max(
      0,
      subtotal - (pedido.desconto ?? 0) - (pedido.descontoPix ?? 0) + pedido.valorFrete
    );

    const e = pedido.enderecoEntrega;
    const enderecoEntrega = e
      ? [
          [e.rua, e.numero].filter(Boolean).join(", "),
          e.complemento,
          e.bairro,
          e.cidade,
        ]
          .filter(Boolean)
          .join(" — ")
      : null;

    const modelo = emailVendaNova({
      clienteNome: cliente?.nome ?? "Cliente",
      clienteTelefone: cliente?.telefone ?? null,
      itens: pedido.itens,
      total,
      formaPagamento: pedido.formaPagamento,
      tipoEntrega: pedido.tipoEntrega,
      enderecoEntrega,
      pontoRetirada: pedido.pontoRetirada,
      prazoEm: pedido.prazoEm?.toISOString() ?? null,
      ehPresente: pedido.ehPresente ?? false,
      nomeQuemRecebe: pedido.nomeQuemRecebe,
      bilhete: pedido.bilhete,
    });

    await enviarEmail({ para, ...modelo });
  } catch (e) {
    console.error("Falha ao avisar a loja da venda:", e);
  }
}

/**
 * Avisa a Camily que um pedido foi cancelado.
 *
 * O aviso de venda conta quando entra dinheiro; este conta quando sai. Vale
 * principalmente para o pedido que já estava **pago**: ali há produção que
 * para e valor que volta, e ela não pode descobrir isso só ao abrir o painel
 * — pior ainda se já tiver começado a fazer o doce.
 *
 * Nunca lança: o pedido já foi cancelado de qualquer forma, e derrubar o
 * cancelamento por causa de um e-mail deixaria a cliente sem resposta.
 */
export async function avisarLojaDeCancelamento(
  pedidoId: string,
  opcoes: { eraPago: boolean; canceladoPor: string; motivo?: string | null }
): Promise<void> {
  try {
    const para = emailDaLoja();
    if (!para) return;

    const db = getDb();
    const [linha] = await db
      .select({ pedido: pedidos, cliente: clientes })
      .from(pedidos)
      .leftJoin(clientes, eq(pedidos.clienteId, clientes.id))
      .where(eq(pedidos.id, pedidoId));

    if (!linha) return;
    const { pedido, cliente } = linha;

    const subtotal = pedido.itens.reduce(
      (a, i) => a + i.precoUnitario * i.quantidade,
      0
    );
    const total = Math.max(
      0,
      subtotal - (pedido.desconto ?? 0) - (pedido.descontoPix ?? 0) + pedido.valorFrete
    );

    const modelo = emailPedidoCancelado({
      clienteNome: cliente?.nome ?? "Cliente",
      itens: pedido.itens,
      total,
      eraPago: opcoes.eraPago,
      canceladoPor: opcoes.canceladoPor,
      reembolso: pedido.statusReembolso as
        | "nao_precisa"
        | "concluido"
        | "falhou"
        | null,
      motivo: opcoes.motivo ?? pedido.motivoCancelamento,
    });

    await enviarEmail({ para, ...modelo });
  } catch (e) {
    console.error("Falha ao avisar a loja do cancelamento:", e);
  }
}
