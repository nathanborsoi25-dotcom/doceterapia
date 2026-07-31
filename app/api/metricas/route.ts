import { NextResponse } from "next/server";
import { and, gte, lte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { clientes, pedidos, produtos } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/require-admin";
import { calcularPeriodo, variacao, type NomePeriodo } from "@/lib/periodo";
import type { ItemPedido, StatusPedido } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Só pedido pago em diante conta como venda. */
const VENDIDOS: StatusPedido[] = ["pago", "em_preparo", "a_caminho", "concluido"];

type Resumo = {
  pedidos: number;
  faturamento: number;
  lucro: number;
  cancelados: number;
  ticketMedio: number;
};

function vazio(): Resumo {
  return { pedidos: 0, faturamento: 0, lucro: 0, cancelados: 0, ticketMedio: 0 };
}

export async function GET(req: Request) {
  const negado = await requireAdmin();
  if (negado) return negado;

  const nome = (new URL(req.url).searchParams.get("periodo") ??
    "mes") as NomePeriodo;
  const periodo = calcularPeriodo(nome);
  const db = getDb();

  // Custo de produção de cada doce, pra calcular o lucro.
  const listaProdutos = await db.select().from(produtos);
  const custoPorId = new Map(listaProdutos.map((p) => [p.id, p.custo]));
  const semCusto = listaProdutos.filter((p) => p.ativo && p.custo <= 0).length;

  async function resumir(inicio: Date, fim: Date): Promise<{
    resumo: Resumo;
    porProduto: Map<string, { nome: string; quantidade: number; total: number }>;
  }> {
    const linhas = await db
      .select()
      .from(pedidos)
      .where(and(gte(pedidos.criadoEm, inicio), lte(pedidos.criadoEm, fim)));

    const r = vazio();
    const porProduto = new Map<
      string,
      { nome: string; quantidade: number; total: number }
    >();

    for (const p of linhas) {
      if (p.status === "cancelado") {
        r.cancelados++;
        continue;
      }
      if (!VENDIDOS.includes(p.status as StatusPedido)) continue;

      r.pedidos++;

      const itens = p.itens as ItemPedido[];
      const subtotal = itens.reduce((a, i) => a + i.precoUnitario * i.quantidade, 0);
      // O frete é repassado ao entregador, então entra no faturamento mas
      // não no lucro. Quando a entrega é cortesia (frete zero), o custo
      // fica com a Camily — mas esse valor não passa pelo site.
      r.faturamento += subtotal + p.valorFrete;

      const custoItens = itens.reduce(
        (a, i) => a + (custoPorId.get(i.produtoId) ?? 0) * i.quantidade,
        0
      );
      r.lucro += subtotal - custoItens;

      for (const i of itens) {
        const atual = porProduto.get(i.produtoId) ?? {
          nome: i.nome,
          quantidade: 0,
          total: 0,
        };
        atual.quantidade += i.quantidade;
        atual.total += i.precoUnitario * i.quantidade;
        porProduto.set(i.produtoId, atual);
      }
    }

    r.ticketMedio = r.pedidos > 0 ? r.faturamento / r.pedidos : 0;
    return { resumo: r, porProduto };
  }

  const atual = await resumir(periodo.inicio, periodo.fim);
  const anterior = periodo.anterior
    ? (await resumir(periodo.anterior.inicio, periodo.anterior.fim)).resumo
    : null;

  // Clientes: total da loja e quantos entraram no período.
  const [{ total: totalClientes }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(clientes);
  const [{ total: novosClientes }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(clientes)
    .where(and(gte(clientes.criadoEm, periodo.inicio), lte(clientes.criadoEm, periodo.fim)));

  const topProdutos = [...atual.porProduto.entries()]
    .map(([id, v]) => ({ produtoId: id, ...v }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 10);

  return NextResponse.json({
    periodo: {
      nome,
      rotulo: periodo.rotulo,
      rotuloAnterior: periodo.rotuloAnterior,
      inicio: periodo.inicio.toISOString(),
      fim: periodo.fim.toISOString(),
    },
    atual: atual.resumo,
    anterior,
    variacao: anterior
      ? {
          pedidos: variacao(atual.resumo.pedidos, anterior.pedidos),
          faturamento: variacao(atual.resumo.faturamento, anterior.faturamento),
          lucro: variacao(atual.resumo.lucro, anterior.lucro),
          cancelados: variacao(atual.resumo.cancelados, anterior.cancelados),
          ticketMedio: variacao(atual.resumo.ticketMedio, anterior.ticketMedio),
        }
      : null,
    clientes: { total: totalClientes, novos: novosClientes },
    topProdutos,
    /** Quantos doces ativos ainda estão sem custo — o lucro fica torto. */
    produtosSemCusto: semCusto,
  });
}
