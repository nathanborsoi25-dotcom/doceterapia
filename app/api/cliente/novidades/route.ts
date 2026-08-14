import { NextResponse } from "next/server";
import { and, eq, isNull, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { pedidos } from "@/lib/db/schema";
import { getClienteLogado } from "@/lib/cliente-logado";
import { contarNovidades, SEM_NOVIDADES } from "@/lib/novidades";
import { getConfigLoja } from "@/lib/config-loja";

export const dynamic = "force-dynamic";

/**
 * Quantos avisos a cliente tem esperando — o número da bolinha em "Conta".
 *
 * Visitante recebe zero em vez de 401: quem não entrou não tem pedido, e um
 * erro aqui pintaria de vermelho o console de quem só está olhando o
 * cardápio.
 */
export async function GET() {
  // O carimbo das promoções vale pra todo mundo, inclusive pra quem nunca
  // criou conta — é ele que acende a bolinha em "Promoções".
  const promocoesEm = (await getConfigLoja()).promocoesEm?.toISOString() ?? null;

  const cliente = await getClienteLogado();
  if (!cliente) return NextResponse.json({ ...SEM_NOVIDADES, promocoesEm });

  const linhas = await getDb()
    .select({ status: pedidos.status, statusVisto: pedidos.statusVisto })
    .from(pedidos)
    .where(eq(pedidos.clienteId, cliente.id));

  return NextResponse.json({ ...contarNovidades(linhas), promocoesEm });
}

/**
 * "Já vi" — chamado quando ela abre Meus pedidos.
 *
 * Marca cada pedido com a situação em que ele está agora. O pedido que espera
 * pagamento continua aparecendo na conta mesmo assim, porque ali não é um
 * aviso de leitura: é uma coisa pendente pra ela fazer.
 */
export async function POST() {
  const cliente = await getClienteLogado();
  if (!cliente) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  /*
   * `status_visto = status` numa tacada, direto no banco.
   *
   * ⚠️ O `IS NULL` faz falta de verdade: em SQL, `status <> NULL` não dá
   * "verdadeiro", dá NULO — e o pedido que ela nunca abriu (que é justamente
   * o caso mais comum) ficaria de fora do UPDATE, com a bolinha acesa pra
   * sempre. A condição do `<>` continua ali pra não reescrever linha que já
   * estava em dia a cada visita à tela.
   */
  await getDb()
    .update(pedidos)
    .set({ statusVisto: sql`${pedidos.status}` })
    .where(
      and(
        eq(pedidos.clienteId, cliente.id),
        or(isNull(pedidos.statusVisto), ne(pedidos.status, pedidos.statusVisto))
      )
    );

  return NextResponse.json({ ok: true });
}
