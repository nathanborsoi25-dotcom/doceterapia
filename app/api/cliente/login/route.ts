import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { clientes } from "@/lib/db/schema";
import { conferirSenha } from "@/lib/senha";
import { criarSessaoCliente, COOKIE_CLIENTE } from "@/lib/sessao-cliente";
import { OPCOES_COOKIE } from "@/lib/cliente-logado";
import { apenasDigitos } from "@/lib/validacoes";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    cpf?: string;
    senha?: string;
  };

  const cpf = apenasDigitos(body.cpf ?? "");
  const senha = typeof body.senha === "string" ? body.senha : "";

  // Mensagem igual para CPF inexistente e senha errada: não entregamos a
  // quem tenta adivinhar a informação de quais CPFs têm conta aqui.
  const generico = { error: "CPF ou senha incorretos." };

  if (cpf.length !== 11 || !senha) {
    return NextResponse.json(generico, { status: 401 });
  }

  const [cliente] = await getDb()
    .select()
    .from(clientes)
    .where(eq(clientes.cpf, cpf));

  if (!cliente || !(await conferirSenha(senha, cliente.senhaHash))) {
    return NextResponse.json(generico, { status: 401 });
  }

  const token = await criarSessaoCliente(
    process.env.ADMIN_SESSION_SECRET!,
    cliente.id
  );
  cookies().set(COOKIE_CLIENTE, token, OPCOES_COOKIE);

  return NextResponse.json({ ok: true });
}
