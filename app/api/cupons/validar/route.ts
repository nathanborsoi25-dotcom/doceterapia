import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { cupons, produtos, sabores } from "@/lib/db/schema";
import { getClienteLogado } from "@/lib/cliente-logado";
import { avaliarCupom, normalizarCodigo } from "@/lib/cupom";
import { precoAPagar, precoCheio } from "@/lib/promocao";
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

  // Os recheios entram na conta: um recheio pode custar mais que o doce, e
  // pode estar em promoção sozinho. Sem eles o subtotal saía errado.
  const [doBanco, recheios] = await Promise.all([
    ids.length ? db.select().from(produtos).where(inArray(produtos.id, ids)) : [],
    ids.length ? db.select().from(sabores).where(inArray(sabores.produtoId, ids)) : [],
  ]);
  const porId = new Map(doBanco.map((p) => [p.id, p]));
  const saborPorId = new Map(recheios.map((s) => [s.id, s]));

  /*
   * Duas somas: o carrinho inteiro (que decide o pedido mínimo) e só a parte
   * fora de promoção (que é onde o cupom pode encostar). Os preços saem do
   * banco — o que vem do navegador não serve nem aqui, senão dava pra inflar
   * o desconto ou forjar uma promoção.
   */
  let subtotal = 0;
  let subtotalQueAceita = 0;

  for (const item of body.itens ?? []) {
    const produto = porId.get(item?.produtoId);
    if (!produto) continue;
    const sabor = item?.saborId ? saborPorId.get(item.saborId) : undefined;
    const q = Math.max(0, Math.floor(Number(item?.quantidade)) || 0);

    const aPagar = precoAPagar(produto, sabor);
    subtotal += aPagar * q;
    if (aPagar >= precoCheio(produto, sabor)) subtotalQueAceita += aPagar * q;
  }

  const [cupom] = await db.select().from(cupons).where(eq(cupons.codigo, codigo));
  const r = avaliarCupom(cupom, subtotal, cliente.id, undefined, subtotalQueAceita);

  if (!r.valido) {
    return NextResponse.json({ error: r.motivo }, { status: 400 });
  }

  return NextResponse.json({
    codigo: r.cupom.codigo,
    descricao: r.cupom.descricao,
    desconto: r.desconto,
    /* A tela avisa quando o cupom valeu só em parte do carrinho, pra pessoa
       não achar que o desconto veio menor por engano. */
    valeuEmParte: subtotalQueAceita > 0 && subtotalQueAceita < subtotal,
  });
}
