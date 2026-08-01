import { NextResponse } from "next/server";
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { cupons, recompensas } from "@/lib/db/schema";
import { getClienteLogado } from "@/lib/cliente-logado";
import { extratoDePontos, saldoDePontos } from "@/lib/fidelidade";

export const dynamic = "force-dynamic";

/**
 * O que a tela "Minha conta" mostra além dos pedidos: saldo de pontos, de
 * onde eles vieram, os cupons que a pessoa pode usar e os prêmios do
 * programa de fidelidade.
 *
 * Os cupons são filtrados aqui no servidor: o cliente só recebe os da loja
 * toda e os que são exclusivos DELE. Mandar a lista inteira entregaria o
 * cupom pessoal de outra pessoa.
 */
export async function GET() {
  const cliente = await getClienteLogado();
  if (!cliente) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const db = getDb();
  const agora = new Date();

  const [saldo, extrato, disponiveis, premios] = await Promise.all([
    saldoDePontos(cliente.id),
    extratoDePontos(cliente.id),
    db
      .select()
      .from(cupons)
      .where(
        and(
          eq(cupons.ativo, true),
          // Da loja toda OU exclusivo dele.
          or(isNull(cupons.clienteId), eq(cupons.clienteId, cliente.id)),
          // Ainda no prazo (sem data = sem prazo).
          or(isNull(cupons.expiraEm), gt(cupons.expiraEm, agora)),
          // Ainda tem uso sobrando (limite zero = ilimitado).
          or(eq(cupons.limiteUsos, 0), sql`${cupons.usos} < ${cupons.limiteUsos}`)
        )
      ),
    db.select().from(recompensas).where(eq(recompensas.ativo, true)),
  ]);

  return NextResponse.json({
    saldoPontos: saldo,
    extrato: extrato.map((p) => ({
      id: p.id,
      quantidade: p.quantidade,
      motivo: p.motivo,
      descricao: p.descricao,
      criadoEm: p.criadoEm.toISOString(),
    })),
    cupons: disponiveis.map((c) => ({
      codigo: c.codigo,
      descricao: c.descricao,
      tipo: c.tipo,
      valor: c.valor,
      pedidoMinimo: c.pedidoMinimo,
      expiraEm: c.expiraEm ? c.expiraEm.toISOString() : null,
      exclusivo: Boolean(c.clienteId),
    })),
    recompensas: premios.map((r) => ({
      id: r.id,
      nome: r.nome,
      descricao: r.descricao,
      pontos: r.pontos,
    })),
  });
}
