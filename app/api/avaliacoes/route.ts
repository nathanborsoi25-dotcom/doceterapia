import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { avaliacoes, clientes, pedidos } from "@/lib/db/schema";
import { getClienteLogado } from "@/lib/cliente-logado";
import { notaValida, primeiroNome } from "@/lib/avaliacoes";
import { lancarPontos } from "@/lib/fidelidade";
import { getConfigLoja } from "@/lib/config-loja";
import type { Avaliacao } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Avaliações de um doce, para aparecerem embaixo dele no cardápio.
 * É público de propósito — a graça é justamente quem ainda não comprou ler.
 * Só saem as visíveis, e de cada pessoa só o primeiro nome.
 */
export async function GET(req: Request) {
  const produtoId = new URL(req.url).searchParams.get("produtoId");
  if (!produtoId) {
    return NextResponse.json({ error: "Informe o doce." }, { status: 400 });
  }

  const linhas = await getDb()
    .select({ a: avaliacoes, nome: clientes.nome })
    .from(avaliacoes)
    .leftJoin(clientes, eq(avaliacoes.clienteId, clientes.id))
    .where(and(eq(avaliacoes.produtoId, produtoId), eq(avaliacoes.visivel, true)))
    .orderBy(desc(avaliacoes.criadoEm));

  const resultado: Avaliacao[] = linhas.map(({ a, nome }) => ({
    id: a.id,
    produtoId: a.produtoId,
    pedidoId: a.pedidoId,
    nota: a.nota,
    comentario: a.comentario,
    criadoEm: a.criadoEm.toISOString(),
    clienteNome: primeiroNome(nome ?? "Cliente"),
  }));

  return NextResponse.json(resultado);
}

/**
 * O cliente avaliando um doce que comprou.
 *
 * Três travas, todas conferidas no servidor: o pedido tem que ser dele, tem
 * que estar entregue, e o doce tem que estar dentro daquele pedido. Sem isso,
 * qualquer pessoa poderia encher o cardápio de nota 1 (ou 5) sem ter comprado.
 */
export async function POST(req: Request) {
  const cliente = await getClienteLogado();
  if (!cliente) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    pedidoId?: string;
    produtoId?: string;
    nota?: number;
    comentario?: string;
  };

  if (!body.pedidoId || !body.produtoId) {
    return NextResponse.json({ error: "Avaliação incompleta." }, { status: 400 });
  }
  if (!notaValida(body.nota)) {
    return NextResponse.json(
      { error: "Escolha uma nota de 1 a 5 estrelas." },
      { status: 400 }
    );
  }

  const db = getDb();
  const [pedido] = await db
    .select()
    .from(pedidos)
    .where(eq(pedidos.id, body.pedidoId));

  if (!pedido || pedido.clienteId !== cliente.id) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }
  if (pedido.status !== "concluido") {
    return NextResponse.json(
      { error: "Você pode avaliar depois que o pedido for entregue." },
      { status: 400 }
    );
  }
  if (!pedido.itens.some((i) => i.produtoId === body.produtoId)) {
    return NextResponse.json(
      { error: "Este doce não faz parte deste pedido." },
      { status: 400 }
    );
  }

  // O índice único (pedido, doce) é quem garante uma avaliação por doce por
  // compra mesmo se o botão for clicado duas vezes ao mesmo tempo.
  const inseridas = await db
    .insert(avaliacoes)
    .values({
      id: crypto.randomUUID(),
      produtoId: body.produtoId,
      clienteId: cliente.id,
      pedidoId: body.pedidoId,
      nota: Number(body.nota),
      comentario: (body.comentario ?? "").trim().slice(0, 500),
    })
    .onConflictDoNothing()
    .returning({ id: avaliacoes.id });

  if (inseridas.length === 0) {
    return NextResponse.json(
      { error: "Você já avaliou este doce neste pedido." },
      { status: 409 }
    );
  }

  // Avaliar rende pontos, do jeito que a Camily configurou.
  const config = await getConfigLoja();
  const ganhos = Math.max(0, Math.round(config.pontosPorAvaliacao ?? 0));
  if (ganhos > 0) {
    await lancarPontos({
      clienteId: cliente.id,
      quantidade: ganhos,
      motivo: "avaliacao",
      descricao: "Avaliação de um doce",
      pedidoId: body.pedidoId,
    });
  }

  return NextResponse.json({ ok: true, pontosGanhos: ganhos });
}
