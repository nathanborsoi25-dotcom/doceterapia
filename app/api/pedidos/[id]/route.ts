import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { pedidos } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/require-admin";
import { avisarMudancaDeStatus } from "@/lib/avisar-cliente";
import { cancelarPedido } from "@/lib/cancelamento";
import { garantirPontosDaCompra } from "@/lib/fidelidade";
import type { StatusPedido } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Situações em que a venda aconteceu de fato — é a partir de qualquer uma
 * delas que a compra precisa ter pontuado.
 */
const VENDA: StatusPedido[] = ["pago", "em_preparo", "pronto", "a_caminho", "concluido"];

/** Aceita só http/https, pra não virar porta de entrada de link estranho. */
function linkValido(valor: unknown): string | null {
  if (typeof valor !== "string" || !valor.trim()) return null;
  try {
    const url = new URL(valor.trim());
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString().slice(0, 500)
      : null;
  } catch {
    return null;
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const negado = await requireAdmin();
  if (negado) return negado;

  const body = (await req.json().catch(() => ({}))) as {
    status?: StatusPedido;
    linkRastreio?: string;
    motivo?: string;
    /** Quanto devolver ao cancelar. Ausente = o valor inteiro do pedido. */
    valorReembolso?: number;
  };

  const db = getDb();

  // Cancelar não é "só" mudar a situação: tem dinheiro pra devolver, pontos
  // pra tirar e cupom pra liberar. Por isso passa pelo mesmo caminho que o
  // cliente usa quando cancela sozinho.
  if (body.status === "cancelado") {
    const r = await cancelarPedido(params.id, {
      por: "loja",
      motivo: body.motivo,
      valorReembolso: Number.isFinite(body.valorReembolso)
        ? Number(body.valorReembolso)
        : undefined,
    });
    if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 400 });
    return NextResponse.json({
      ok: true,
      reembolso: r.reembolso,
      valorReembolsado: r.valorReembolsado,
    });
  }

  const mudancas: { status?: StatusPedido; linkRastreio?: string | null } = {};

  if (body.status) mudancas.status = body.status;
  // O link é gravado ANTES do aviso, pra ele já sair dentro do e-mail.
  if (body.linkRastreio !== undefined) {
    mudancas.linkRastreio = linkValido(body.linkRastreio);
  }

  if (Object.keys(mudancas).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  await db.update(pedidos).set(mudancas).where(eq(pedidos.id, params.id));

  /*
   * Pedido que a Camily marca como vendido à mão também pontua.
   *
   * ⚠️ Isto existe por um caso real: uma cliente pagou, a loja concluiu o
   * pedido pelo painel — sem passar pelo webhook do Mercado Pago, que é quem
   * credita — e ela ficou com saldo zero depois de comprar. Agora qualquer
   * etapa de venda garante os pontos daquela compra.
   *
   * `garantirPontosDaCompra` é idempotente: se o extrato já tem o lançamento
   * deste pedido, ela não faz nada. Assim o caminho normal (webhook credita,
   * Camily depois muda para "em preparo") não pontua duas vezes.
   */
  if (body.status && VENDA.includes(body.status)) {
    await garantirPontosDaCompra(params.id);
  }

  // Avisa o cliente da mudança. Não trava a resposta: se o e-mail falhar, a
  // situação do pedido já foi salva de qualquer jeito.
  if (body.status) await avisarMudancaDeStatus(params.id, body.status);

  return NextResponse.json({ ok: true });
}
