import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { produtos } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/require-admin";
import { mediasPorProduto } from "@/lib/avaliacoes";
import type { Produto } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const rows = await db.select().from(produtos);

  // A nota dos clientes vem junto: o cardápio mostra as estrelas embaixo de
  // cada doce sem precisar de uma segunda ida ao servidor por card.
  const medias = await mediasPorProduto();

  return NextResponse.json(
    rows.map((p) => ({
      ...p,
      notaMedia: medias.get(p.id)?.media ?? 0,
      totalAvaliacoes: medias.get(p.id)?.total ?? 0,
    }))
  );
}

// Criar/editar produto: só o admin logado.
export async function POST(req: Request) {
  const negado = await requireAdmin();
  if (negado) return negado;

  const p = (await req.json()) as Produto;
  const values = {
    id: p.id,
    nome: p.nome,
    descricao: p.descricao ?? "",
    sabor: p.sabor ?? "",
    preco: p.preco ?? 0,
    custo: Math.max(0, Number(p.custo) || 0),
    fotoUrl: p.fotoUrl ?? "",
    disponibilidade: p.disponibilidade,
    prazoDias: p.prazoDias ?? null,
    // Campo vazio = sem controle de estoque (null). Zero é esgotado, então
    // os dois casos precisam continuar distintos até o banco.
    estoque:
      p.estoque == null || p.estoque === ("" as unknown)
        ? null
        : Math.max(0, Math.floor(Number(p.estoque) || 0)),
    ativo: p.ativo ?? true,
  };
  const db = getDb();
  await db.insert(produtos).values(values).onConflictDoUpdate({
    target: produtos.id,
    set: values,
  });
  return NextResponse.json({ ok: true });
}
