import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { carrinhos, clientes } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

/**
 * Carrinhos que ficaram para trás: alguém escolheu doces e não finalizou.
 * É a deixa da Camily pra dar um toque no WhatsApp e resgatar a venda.
 * Quando o pedido é criado, o carrinho é apagado — então tudo o que está
 * aqui é, por definição, compra não concluída.
 */
export async function GET() {
  const negado = await requireAdmin();
  if (negado) return negado;

  const db = getDb();
  const linhas = await db
    .select({ carrinho: carrinhos, cliente: clientes })
    .from(carrinhos)
    .leftJoin(clientes, eq(carrinhos.clienteId, clientes.id))
    .orderBy(desc(carrinhos.atualizadoEm));

  return NextResponse.json(
    linhas.map(({ carrinho, cliente }) => ({
      clienteId: carrinho.clienteId,
      itens: carrinho.itens,
      total: carrinho.itens.reduce(
        (a, i) => a + i.precoUnitario * i.quantidade,
        0
      ),
      atualizadoEm: carrinho.atualizadoEm.toISOString(),
      clienteNome: cliente?.nome ?? null,
      clienteTelefone: cliente?.telefone ?? null,
    }))
  );
}
