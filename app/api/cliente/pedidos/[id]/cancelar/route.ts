import { NextResponse } from "next/server";
import { getClienteLogado } from "@/lib/cliente-logado";
import { cancelarPedido } from "@/lib/cancelamento";

export const dynamic = "force-dynamic";

/**
 * O cliente cancelando o próprio pedido.
 *
 * Só vale enquanto o pedido está "aguardando pagamento" ou "pago" — depois
 * que a Camily começa a preparar, os ingredientes já foram usados e o
 * cancelamento passa por ela. Quem é o dono do pedido vem da sessão.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const cliente = await getClienteLogado();
  if (!cliente) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { motivo?: string };

  const r = await cancelarPedido(params.id, {
    por: "cliente",
    motivo: typeof body.motivo === "string" ? body.motivo : "",
    clienteId: cliente.id,
  });

  if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 400 });

  return NextResponse.json({
    ok: true,
    reembolso: r.reembolso,
    valorReembolsado: r.valorReembolsado,
  });
}
