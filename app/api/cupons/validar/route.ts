import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { cupons, produtos } from "@/lib/db/schema";
import { getClienteLogado } from "@/lib/cliente-logado";
import { avaliarCupom, normalizarCodigo } from "@/lib/cupom";
import type { ItemPedido } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Confere o cupom que o cliente digitou no checkout e devolve o desconto.
 * O subtotal é recalculado a partir dos preços do banco — o que vem do
 * navegador não serve nem aqui, senão dava pra inflar o desconto.
 */
export async function POST(req: Request) {
  const cliente = await getClienteLogado();
  if (!cliente) {
    return NextResponse.json({ error: "Faça login para usar cupom." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    codigo?: string;
    itens?: ItemPedido[];
  };

  const codigo = normalizarCodigo(body.codigo ?? "");
  if (!codigo) {
    return NextResponse.json({ error: "Digite o código do cupom." }, { status: 400 });
  }

  const db = getDb();

  const ids = Array.from(
    new Set((body.itens ?? []).map((i) => i?.produtoId).filter(Boolean) as string[])
  );
  const doBanco = ids.length
    ? await db.select().from(produtos).where(inArray(produtos.id, ids))
    : [];
  const precoPorId = new Map(doBanco.map((p) => [p.id, p.preco]));

  const subtotal = (body.itens ?? []).reduce((a, i) => {
    const preco = precoPorId.get(i?.produtoId) ?? 0;
    const q = Math.floor(Number(i?.quantidade)) || 0;
    return a + preco * Math.max(0, q);
  }, 0);

  const [cupom] = await db.select().from(cupons).where(eq(cupons.codigo, codigo));
  const r = avaliarCupom(cupom, subtotal, cliente.id);

  if (!r.valido) {
    return NextResponse.json({ error: r.motivo }, { status: 400 });
  }

  return NextResponse.json({
    codigo: r.cupom.codigo,
    descricao: r.cupom.descricao,
    desconto: r.desconto,
  });
}
