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
    cpf: row.cpf,
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

// Lista de clientes = dado pessoal. Só o admin logado pode ler.
export async function GET() {
  const negado = await requireAdmin();
  if (negado) return negado;

  const db = getDb();
  const rows = await db.select().from(clientes).orderBy(desc(clientes.criadoEm));
  return NextResponse.json(rows.map(toCliente));
}

export async function POST(req: Request) {
  const c = (await req.json()) as Cliente;
  const values = {
    id: c.id,
    nome: c.nome,
    cpf: c.cpf,
    telefone: c.telefone ?? "",
    rua: c.endereco.rua ?? "",
    numero: c.endereco.numero ?? "",
    bairro: c.endereco.bairro ?? "",
    cidade: c.endereco.cidade ?? "",
    cep: c.endereco.cep ?? "",
    complemento: c.endereco.complemento ?? null,
    lat: c.endereco.lat ?? null,
    lng: c.endereco.lng ?? null,
  };
  // Não sobrescreve o id original quando o mesmo CPF se cadastra de novo.
  const { id: _id, ...setValues } = values;
  const db = getDb();
  await db.insert(clientes).values(values).onConflictDoUpdate({
    target: clientes.cpf,
    set: setValues,
  });
  return NextResponse.json({ ok: true });
}
