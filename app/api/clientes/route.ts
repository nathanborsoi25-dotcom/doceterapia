import { NextResponse } from "next/server";
import { desc, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { clientes, pontos } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/require-admin";
import type { Cliente, ClienteDoPainel } from "@/lib/types";

export const dynamic = "force-dynamic";

function toCliente(row: typeof clientes.$inferSelect): Cliente {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    telefone: row.telefone,
    endereco: {
      rua: row.rua,
      numero: row.numero,
      bairro: row.bairro,
      cidade: row.cidade,
      cep: row.cep,
      complemento: row.complemento ?? undefined,
      lat: row.lat ?? undefined,
      lng: row.lng ?? undefined,
    },
    criadoEm: row.criadoEm.toISOString(),
  };
}

/**
 * Lista de clientes = dado pessoal. Só o admin logado pode ler.
 *
 * Só existe o GET aqui. Havia também um POST público que gravava cadastro
 * fazendo upsert pelo CPF — quem soubesse o CPF de alguém sobrescrevia os
 * dados daquela pessoa. Quem cria conta hoje passa por
 * `/api/cliente/cadastro`, que exige senha e recusa e-mail já cadastrado.
 */
export async function GET() {
  const negado = await requireAdmin();
  if (negado) return negado;

  const db = getDb();
  const rows = await db.select().from(clientes).orderBy(desc(clientes.criadoEm));

  /*
   * O saldo de pontos de TODO mundo numa consulta só.
   *
   * Perguntar cliente por cliente (`saldoDePontos`) seria uma ida ao banco por
   * pessoa — a lista inteira viraria dezenas de consultas para desenhar uma
   * tela. Aqui o banco soma o extrato agrupado por cliente e devolve tudo de
   * uma vez. O saldo continua sendo a SOMA do extrato, nunca um número
   * guardado à parte.
   */
  const somas = await db
    .select({
      clienteId: pontos.clienteId,
      saldo: sql<number>`coalesce(sum(${pontos.quantidade}), 0)::int`,
    })
    .from(pontos)
    .groupBy(pontos.clienteId);

  const pontosPorCliente = new Map(somas.map((s) => [s.clienteId, s.saldo]));

  const lista: ClienteDoPainel[] = rows.map((row) => ({
    ...toCliente(row),
    // Quem nunca pontuou não aparece na soma: sem extrato, saldo zero.
    pontos: pontosPorCliente.get(row.id) ?? 0,
  }));

  return NextResponse.json(lista);
}
