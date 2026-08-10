import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { clientes, cupons } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/require-admin";
import { normalizarCodigo } from "@/lib/cupom";

export const dynamic = "force-dynamic";

/**
 * "2026-08-31" vira o último instante daquele dia em Brasília (23:59:59 no
 * horário de -03:00). O cupom precisa valer o dia inteiro que a Camily
 * escolheu: com `new Date("2026-08-31")` ele venceria à meia-noite UTC, ou
 * seja, às 21h do dia 30 aqui — o mesmo tropeço de fuso que já derrubou o
 * prazo dos pedidos (ver `lib/prazo.ts`).
 */
function fimDoDiaEmBrasilia(texto: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto.trim())) return null;
  const data = new Date(`${texto.trim()}T23:59:59.999-03:00`);
  return Number.isNaN(data.getTime()) ? null : data;
}

/** Lista os cupons com o nome do cliente, quando for cupom pessoal. */
export async function GET() {
  const negado = await requireAdmin();
  if (negado) return negado;

  const db = getDb();
  const linhas = await db
    .select({ cupom: cupons, cliente: clientes })
    .from(cupons)
    .leftJoin(clientes, eq(cupons.clienteId, clientes.id))
    .orderBy(desc(cupons.criadoEm));

  return NextResponse.json(
    linhas.map(({ cupom, cliente }) => ({
      ...cupom,
      expiraEm: cupom.expiraEm?.toISOString() ?? null,
      criadoEm: cupom.criadoEm.toISOString(),
      clienteNome: cliente?.nome ?? null,
    }))
  );
}

export async function POST(req: Request) {
  const negado = await requireAdmin();
  if (negado) return negado;

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const codigo = normalizarCodigo(String(b.codigo ?? ""));

  if (codigo.length < 3) {
    return NextResponse.json(
      { error: "O código precisa ter pelo menos 3 letras." },
      { status: 400 }
    );
  }

  const tipo = b.tipo === "valor" ? "valor" : "percentual";
  const valor = Number(b.valor);
  if (!Number.isFinite(valor) || valor <= 0) {
    return NextResponse.json({ error: "Informe o valor do desconto." }, { status: 400 });
  }
  if (tipo === "percentual" && valor > 100) {
    return NextResponse.json(
      { error: "Um desconto em porcentagem não pode passar de 100%." },
      { status: 400 }
    );
  }

  const db = getDb();
  const [existente] = await db.select().from(cupons).where(eq(cupons.codigo, codigo));
  if (existente) {
    return NextResponse.json(
      { error: "Já existe um cupom com esse código." },
      { status: 409 }
    );
  }

  /*
   * O vencimento passou a ser obrigatório: cupom sem prazo fica valendo para
   * sempre e ninguém lembra de desligar. A data chega como "2026-08-31" e é
   * montada no fim do dia, no fuso daqui — senão o cupom morreria às 21h do
   * dia anterior em Brasília (a Vercel roda em UTC).
   */
  const expiraEm = fimDoDiaEmBrasilia(String(b.expiraEm ?? ""));
  if (!expiraEm) {
    return NextResponse.json(
      { error: "Escolha até quando o cupom vale." },
      { status: 400 }
    );
  }

  await db.insert(cupons).values({
    id: crypto.randomUUID(),
    codigo,
    descricao: String(b.descricao ?? "").slice(0, 200),
    tipo,
    valor,
    pedidoMinimo: Math.max(0, Number(b.pedidoMinimo) || 0),
    clienteId: b.clienteId ? String(b.clienteId) : null,
    somentePix: b.somentePix === true,
    expiraEm,
    limiteUsos: Math.max(0, Math.floor(Number(b.limiteUsos) || 0)),
  });

  return NextResponse.json({ ok: true, codigo });
}
