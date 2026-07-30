import { NextResponse } from "next/server";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { clientes, codigosSenha } from "@/lib/db/schema";
import { conferirSenha, gerarHashSenha } from "@/lib/senha";
import { validarSenha } from "@/lib/senha-regras";
import { apenasDigitos } from "@/lib/validacoes";

export const dynamic = "force-dynamic";

/** Depois disso o código é queimado, pra ninguém ficar tentando adivinhar. */
const TENTATIVAS_MAXIMAS = 5;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    cpf?: string;
    codigo?: string;
    senha?: string;
    confirmarSenha?: string;
  };

  const cpf = apenasDigitos(body.cpf ?? "");
  const codigo = apenasDigitos(body.codigo ?? "");

  const erroSenha = validarSenha(body.senha);
  if (erroSenha) return NextResponse.json({ error: erroSenha }, { status: 400 });
  if (body.senha !== body.confirmarSenha) {
    return NextResponse.json({ error: "As senhas não são iguais." }, { status: 400 });
  }

  const invalido = { error: "Código inválido ou expirado. Peça um novo." };
  if (cpf.length !== 11 || codigo.length !== 6) {
    return NextResponse.json(invalido, { status: 400 });
  }

  const db = getDb();
  const [cliente] = await db.select().from(clientes).where(eq(clientes.cpf, cpf));
  if (!cliente) return NextResponse.json(invalido, { status: 400 });

  // Pega o código mais recente que ainda não foi usado nem venceu.
  const [registro] = await db
    .select()
    .from(codigosSenha)
    .where(
      and(
        eq(codigosSenha.clienteId, cliente.id),
        isNull(codigosSenha.usadoEm),
        gt(codigosSenha.expiraEm, new Date())
      )
    )
    .orderBy(desc(codigosSenha.criadoEm));

  if (!registro) return NextResponse.json(invalido, { status: 400 });

  if (registro.tentativas >= TENTATIVAS_MAXIMAS) {
    await db
      .update(codigosSenha)
      .set({ usadoEm: new Date() })
      .where(eq(codigosSenha.id, registro.id));
    return NextResponse.json(
      { error: "Muitas tentativas erradas. Peça um novo código." },
      { status: 429 }
    );
  }

  if (!(await conferirSenha(codigo, registro.codigoHash))) {
    await db
      .update(codigosSenha)
      .set({ tentativas: registro.tentativas + 1 })
      .where(eq(codigosSenha.id, registro.id));
    return NextResponse.json(invalido, { status: 400 });
  }

  // Código certo: troca a senha e queima o código.
  await db
    .update(clientes)
    .set({ senhaHash: await gerarHashSenha(body.senha as string) })
    .where(eq(clientes.id, cliente.id));
  await db
    .update(codigosSenha)
    .set({ usadoEm: new Date() })
    .where(eq(codigosSenha.id, registro.id));

  return NextResponse.json({ ok: true });
}
