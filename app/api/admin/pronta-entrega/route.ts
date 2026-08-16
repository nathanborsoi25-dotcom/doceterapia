import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { getConfigLoja } from "@/lib/config-loja";
import {
  pausarProntaEntrega,
  quantosNaPausa,
  voltarProntaEntrega,
} from "@/lib/pausa-pronta-entrega";

export const dynamic = "force-dynamic";

/**
 * O botão "vou sair": todo doce de pronta entrega vira encomenda de 1 dia — e
 * volta ao normal quando ela chega.
 *
 * `POST { pausar: true }` liga, `POST { pausar: false }` desliga. A conta toda
 * mora em `lib/pausa-pronta-entrega.ts`, que é o que os testes conseguem
 * chamar; aqui fica só a porta.
 */
export async function POST(req: Request) {
  const negado = await requireAdmin();
  if (negado) return negado;

  const { pausar } = (await req.json().catch(() => ({}))) as { pausar?: boolean };

  if (pausar) {
    const pausa = await pausarProntaEntrega();
    if (!pausa) {
      return NextResponse.json(
        { error: "Nenhum doce está em pronta entrega agora." },
        { status: 400 }
      );
    }

    // O cardápio mudou de prazo: as telas de servidor precisam ser refeitas.
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, pausa, quantos: quantosNaPausa(pausa) });
  }

  const config = await getConfigLoja();
  const pausa = config.pausaProntaEntrega;
  if (!pausa) {
    return NextResponse.json({ error: "Não há nada pausado." }, { status: 400 });
  }

  const quantos = await voltarProntaEntrega(pausa);
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, quantos });
}
