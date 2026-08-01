import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { tentarEstornoDeNovo } from "@/lib/cancelamento";

export const dynamic = "force-dynamic";

/**
 * Botão "tentar estorno de novo" do painel. Existe porque o estorno pode
 * falhar por um tropeço de conexão com o Mercado Pago, e nesses casos é bem
 * mais simples pra Camily clicar aqui do que entrar no site deles.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const negado = await requireAdmin();
  if (negado) return negado;

  const r = await tentarEstornoDeNovo(params.id);
  if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 400 });

  return NextResponse.json({ ok: true, valorReembolsado: r.valorReembolsado });
}
