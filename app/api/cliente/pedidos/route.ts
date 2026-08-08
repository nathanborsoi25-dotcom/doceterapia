import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { avaliacoes, pedidos } from "@/lib/db/schema";
import { getClienteLogado } from "@/lib/cliente-logado";
import { clientePodeCancelar } from "@/lib/cancelamento";
import type { PedidoDoCliente, StatusPedido } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Histórico de pedidos de quem está logado — a base da tela "Minha conta".
 *
 * Quem é o dono sai da SESSÃO, nunca de um id mandado pelo navegador: senão
 * bastaria trocar o número na URL pra ler a compra de outra pessoa.
 */
export async function GET() {
  const cliente = await getClienteLogado();
  if (!cliente) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const db = getDb();
  const linhas = await db
    .select()
    .from(pedidos)
    .where(eq(pedidos.clienteId, cliente.id))
    .orderBy(desc(pedidos.criadoEm));

  // Quais doces ele já avaliou, pra tela não oferecer de novo.
  const jaAvaliados = await db
    .select({ pedidoId: avaliacoes.pedidoId, produtoId: avaliacoes.produtoId })
    .from(avaliacoes)
    .where(eq(avaliacoes.clienteId, cliente.id));

  const resultado: PedidoDoCliente[] = linhas.map((p) => {
    const status = p.status as StatusPedido;
    return {
      id: p.id,
      clienteId: p.clienteId ?? "",
      itens: p.itens,
      tipoEntrega: p.tipoEntrega as PedidoDoCliente["tipoEntrega"],
      dataAgendada: p.dataAgendada,
      pontoRetirada: p.pontoRetirada,
      enderecoEntrega: p.enderecoEntrega ?? undefined,
      valorFrete: p.valorFrete,
      formaPagamento: p.formaPagamento as PedidoDoCliente["formaPagamento"],
      status,
      criadoEm: p.criadoEm.toISOString(),
      prazoEm: p.prazoEm ? p.prazoEm.toISOString() : null,
      linkRastreio: p.linkRastreio,
      cupomCodigo: p.cupomCodigo,
      desconto: p.desconto,
      ehPresente: p.ehPresente,
      nomeQuemRecebe: p.nomeQuemRecebe,
      bilhete: p.bilhete,
      podeCancelar: clientePodeCancelar(status),
      statusReembolso: p.statusReembolso,
      // Só faz sentido avaliar o que a pessoa recebeu de fato.
      podeAvaliar: status === "concluido",
      avaliados: jaAvaliados
        .filter((a) => a.pedidoId === p.id)
        .map((a) => a.produtoId),
    };
  });

  return NextResponse.json(resultado);
}
