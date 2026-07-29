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

/** Corta textos vindos do navegador pra não gravar campos gigantes no banco. */
function texto(valor: unknown, limite = 120): string {
  return typeof valor === "string" ? valor.trim().slice(0, limite) : "";
}

/** Só aceita coordenada plausível (o resto vira null e o frete é barrado). */
function coordenada(valor: unknown, max: number): number | null {
  const n = Number(valor);
  return Number.isFinite(n) && Math.abs(n) <= max ? n : null;
}

// Rota pública: é ela que grava o cadastro feito pelo cliente no site.
export async function POST(req: Request) {
  const c = (await req.json().catch(() => null)) as Cliente | null;
  if (!c || typeof c !== "object" || !c.endereco) {
    return NextResponse.json({ error: "Cadastro inválido." }, { status: 400 });
  }

  const nome = texto(c.nome);
  const cpf = texto(c.cpf, 20);
  if (!nome || cpf.replace(/\D/g, "").length !== 11) {
    return NextResponse.json(
      { error: "Informe nome e um CPF válido." },
      { status: 400 }
    );
  }

  const values = {
    id: texto(c.id, 40) || crypto.randomUUID(),
    nome,
    cpf,
    telefone: texto(c.telefone, 30),
    rua: texto(c.endereco.rua),
    numero: texto(c.endereco.numero, 20),
    bairro: texto(c.endereco.bairro),
    cidade: texto(c.endereco.cidade),
    cep: texto(c.endereco.cep, 12),
    complemento: texto(c.endereco.complemento) || null,
    lat: coordenada(c.endereco.lat, 90),
    lng: coordenada(c.endereco.lng, 180),
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
