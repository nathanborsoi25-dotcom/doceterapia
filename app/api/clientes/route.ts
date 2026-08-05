import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { clientes } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/require-admin";
import type { Cliente } from "@/lib/types";

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
  return NextResponse.json(rows.map(toCliente));
}
