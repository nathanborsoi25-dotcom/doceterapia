import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { clientes, pedidos } from "./db/schema";
import { emailStatusPedido, enviarEmail } from "./email";
import type { StatusPedido } from "./types";

/**
 * Avisa o cliente por e-mail que a situação do pedido mudou.
 *
 * Nunca lança erro: se o e-mail falhar, o pedido já mudou de situação do
 * mesmo jeito — não faz sentido derrubar a operação da Camily por causa
 * disso. A falha fica registrada no log.
 */
export async function avisarMudancaDeStatus(
  pedidoId: string,
  status: StatusPedido
): Promise<void> {
  try {
    const db = getDb();
    const [linha] = await db
      .select({ pedido: pedidos, cliente: clientes })
      .from(pedidos)
      .leftJoin(clientes, eq(pedidos.clienteId, clientes.id))
      .where(eq(pedidos.id, pedidoId));

    const cliente = linha?.cliente;
    if (!linha || !cliente?.email) return;

    const total =
      linha.pedido.itens.reduce((a, i) => a + i.precoUnitario * i.quantidade, 0) +
      linha.pedido.valorFrete;

    const modelo = emailStatusPedido({
      nome: cliente.nome,
      status,
      tipoEntrega: linha.pedido.tipoEntrega,
      itens: linha.pedido.itens,
      total,
      prazoEm: linha.pedido.prazoEm?.toISOString() ?? null,
    });
    if (!modelo) return; // situação que não rende aviso

    await enviarEmail({ para: cliente.email, ...modelo });
  } catch (e) {
    console.error("Falha ao avisar o cliente por e-mail:", e);
  }
}
