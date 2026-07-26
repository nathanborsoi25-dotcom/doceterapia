import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { pedidos } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/require-admin";
import type { FormaPagamento, Pedido, TipoEntrega } from "@/lib/types";

export const dynamic = "force-dynamic";

function toPedido(row: typeof pedidos.$inferSelect): Pedido {
  return {
    id: row.id,
    clienteId: row.clienteId ?? "",
    itens: row.itens,
    tipoEntrega: row.tipoEntrega as TipoEntrega,
    dataAgendada: row.dataAgendada,
    enderecoEntrega: row.enderecoEntrega ?? undefined,
    valorFrete: row.valorFrete,
    formaPagamento: row.formaPagamento as FormaPagamento,
    status: row.status as Pedido["status"],
    criadoEm: row.criadoEm.toISOString(),
  };
}

// Lista de pedidos = dado sensível. Só o admin logado pode ler.
export async function GET() {
  const negado = await requireAdmin();
  if (negado) return negado;

  const db = getDb();
  const rows = await db.select().from(pedidos).orderBy(desc(pedidos.criadoEm));
  return NextResponse.json(rows.map(toPedido));
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<Pedido>;
  const id = crypto.randomUUID();
  const db = getDb();
  await db.insert(pedidos).values({
    id,
    clienteId: body.clienteId ?? null,
    itens: body.itens ?? [],
    tipoEntrega: body.tipoEntrega ?? "entrega",
    dataAgendada: body.dataAgendada ?? "",
    enderecoEntrega: body.enderecoEntrega ?? null,
    valorFrete: body.valorFrete ?? 0,
    formaPagamento: body.formaPagamento ?? "pix",
    status: "aguardando_pagamento",
  });
  return NextResponse.json({ id });
}
