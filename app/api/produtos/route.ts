import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { produtos } from "@/lib/db/schema";
import type { Produto } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const rows = await db.select().from(produtos);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const p = (await req.json()) as Produto;
  const values = {
    id: p.id,
    nome: p.nome,
    descricao: p.descricao ?? "",
    sabor: p.sabor ?? "",
    preco: p.preco ?? 0,
    fotoUrl: p.fotoUrl ?? "",
    disponibilidade: p.disponibilidade,
    prazoDias: p.prazoDias ?? null,
    ativo: p.ativo ?? true,
  };
  const db = getDb();
  await db.insert(produtos).values(values).onConflictDoUpdate({
    target: produtos.id,
    set: values,
  });
  return NextResponse.json({ ok: true });
}
