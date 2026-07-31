import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { pedidos } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/require-admin";
import { avisarMudancaDeStatus } from "@/lib/avisar-cliente";
import type { StatusPedido } from "@/lib/types";

export const dynamic = "force-dynamic";

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
  };

  const db = getDb();
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

  // Avisa o cliente da mudança. Não trava a resposta: se o e-mail falhar, a
  // situação do pedido já foi salva de qualquer jeito.
  if (body.status) await avisarMudancaDeStatus(params.id, body.status);

  return NextResponse.json({ ok: true });
}
