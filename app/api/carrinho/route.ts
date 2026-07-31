import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { carrinhos, produtos } from "@/lib/db/schema";
import { getClienteLogado } from "@/lib/cliente-logado";
import { inArray } from "drizzle-orm";
import type { ItemPedido } from "@/lib/types";

export const dynamic = "force-dynamic";

const QUANTIDADE_MAXIMA = 200;

/**
 * Guarda o carrinho do cliente logado. O navegador continua com a cópia dele
 * (é o que faz a tela ser instantânea), mas o banco tem a versão que
 * atravessa aparelhos e que a Camily vê como "carrinho abandonado".
 *
 * Os itens são remontados a partir do banco, mesmo aqui: nome e preço que
 * vêm do navegador são descartados.
 */
export async function POST(req: Request) {
  const cliente = await getClienteLogado();
  if (!cliente) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { itens?: ItemPedido[] };
  const recebidos = Array.isArray(body.itens) ? body.itens : [];

  const db = getDb();

  // Carrinho vazio: some do banco, pra não aparecer como abandonado.
  if (recebidos.length === 0) {
    await db.delete(carrinhos).where(eq(carrinhos.clienteId, cliente.id));
    return NextResponse.json({ ok: true });
  }

  const ids = Array.from(
    new Set(recebidos.map((i) => i?.produtoId).filter(Boolean) as string[])
  );
  const doBanco = ids.length
    ? await db.select().from(produtos).where(inArray(produtos.id, ids))
    : [];
  const porId = new Map(doBanco.map((p) => [p.id, p]));

  const itens: ItemPedido[] = [];
  for (const r of recebidos) {
    const p = porId.get(r?.produtoId);
    if (!p || !p.ativo) continue; // doce saiu do cardápio: ignora
    const quantidade = Math.floor(Number(r?.quantidade));
    if (!Number.isFinite(quantidade) || quantidade < 1 || quantidade > QUANTIDADE_MAXIMA) {
      continue;
    }
    itens.push({
      produtoId: p.id,
      nome: p.nome,
      precoUnitario: p.preco,
      quantidade,
    });
  }

  if (itens.length === 0) {
    await db.delete(carrinhos).where(eq(carrinhos.clienteId, cliente.id));
    return NextResponse.json({ ok: true });
  }

  const agora = new Date();
  await db
    .insert(carrinhos)
    .values({ clienteId: cliente.id, itens, atualizadoEm: agora })
    .onConflictDoUpdate({
      target: carrinhos.clienteId,
      set: { itens, atualizadoEm: agora },
    });

  return NextResponse.json({ ok: true });
}
