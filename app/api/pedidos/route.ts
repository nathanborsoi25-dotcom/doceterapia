import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { clientes, pedidos } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/require-admin";
import type { FormaPagamento, PedidoDoPainel, TipoEntrega } from "@/lib/types";

export const dynamic = "force-dynamic";

// Lista de pedidos = dado sensível. Só o admin logado pode ler.
export async function GET() {
  const negado = await requireAdmin();
  if (negado) return negado;

  const db = getDb();
  // Traz o cliente junto: a Camily precisa do nome e do telefone dele na
  // mesma tela, pra chamar no WhatsApp sem procurar em outro lugar.
  // Ordena pelo prazo, então o que está mais apertado aparece primeiro.
  const linhas = await db
    .select({ pedido: pedidos, cliente: clientes })
    .from(pedidos)
    .leftJoin(clientes, eq(pedidos.clienteId, clientes.id))
    .orderBy(asc(pedidos.prazoEm), asc(pedidos.criadoEm));

  const resultado: PedidoDoPainel[] = linhas.map(({ pedido: p, cliente: c }) => ({
    id: p.id,
    clienteId: p.clienteId ?? "",
    itens: p.itens,
    tipoEntrega: p.tipoEntrega as TipoEntrega,
    dataAgendada: p.dataAgendada,
    pontoRetirada: p.pontoRetirada,
    enderecoEntrega: p.enderecoEntrega ?? undefined,
    valorFrete: p.valorFrete,
    formaPagamento: p.formaPagamento as FormaPagamento,
    status: p.status as PedidoDoPainel["status"],
    criadoEm: p.criadoEm.toISOString(),
    prazoEm: p.prazoEm ? p.prazoEm.toISOString() : null,
    linkRastreio: p.linkRastreio,
    cupomCodigo: p.cupomCodigo,
    desconto: p.desconto,
    descontoPix: p.descontoPix,
    /*
     * Venda de balcão não tem cadastro: o nome e o telefone que ela anotou
     * ficam no próprio pedido. Sem isto, o pedido apareceria sem dono no
     * painel e ela não teria como chamar a pessoa no WhatsApp.
     */
    clienteNome: c?.nome ?? p.nomeContato ?? null,
    clienteTelefone: c?.telefone ?? p.telefoneContato ?? null,
    /** "site" ou "painel" — de onde a venda veio. */
    origem: p.origem,
    statusReembolso: p.statusReembolso,
    valorReembolsado: p.valorReembolsado,
    canceladoPor: p.canceladoPor,
    motivoCancelamento: p.motivoCancelamento,
    ehPresente: p.ehPresente,
    nomeQuemRecebe: p.nomeQuemRecebe,
    bilhete: p.bilhete,
  }));

  return NextResponse.json(resultado);
}

/*
 * NÃO existe POST aqui de propósito. Pedido só nasce em /api/pagamento, que
 * confere os preços no banco, valida a área de entrega e recalcula o frete.
 * Antes havia um POST público e sem validação nenhuma aqui, que permitia
 * criar pedidos falsos (com qualquer preço e frete) direto no painel.
 */
