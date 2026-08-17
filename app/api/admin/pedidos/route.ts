import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { criarPedidoManual, type PedidoManual } from "@/lib/pedido-manual";

export const dynamic = "force-dynamic";

/**
 * O botão "+ Novo pedido" do painel: a venda que a Camily fez por fora do
 * site. A conta toda mora em `lib/pedido-manual.ts` — aqui fica só a porta,
 * que confere se quem chamou é ela.
 */
export async function POST(req: Request) {
  const negado = await requireAdmin();
  if (negado) return negado;

  const body = (await req.json().catch(() => ({}))) as PedidoManual;
  const r = await criarPedidoManual(body);

  if (!r.ok) return NextResponse.json({ error: r.erro }, { status: r.status });
  return NextResponse.json({ ok: true, pedidoId: r.pedidoId, total: r.total });
}
