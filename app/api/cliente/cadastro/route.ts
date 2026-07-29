import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { clientes } from "@/lib/db/schema";
import { gerarHashSenha, validarSenha } from "@/lib/senha";
import { criarSessaoCliente, COOKIE_CLIENTE } from "@/lib/sessao-cliente";
import { OPCOES_COOKIE } from "@/lib/cliente-logado";
import { apenasDigitos, cpfValido, emailValido, telefoneValido } from "@/lib/validacoes";

export const dynamic = "force-dynamic";

function texto(valor: unknown, limite = 120): string {
  return typeof valor === "string" ? valor.trim().slice(0, limite) : "";
}

function coordenada(valor: unknown, max: number): number | null {
  const n = Number(valor);
  return Number.isFinite(n) && Math.abs(n) <= max ? n : null;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, any> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Cadastro inválido." }, { status: 400 });
  }

  const nome = texto(body.nome);
  const cpf = apenasDigitos(texto(body.cpf, 20));
  const email = texto(body.email).toLowerCase();
  const telefone = texto(body.telefone, 30);
  const endereco = body.endereco ?? {};

  if (!nome) {
    return NextResponse.json({ error: "Informe seu nome completo." }, { status: 400 });
  }
  if (!cpfValido(cpf)) {
    return NextResponse.json({ error: "CPF inválido." }, { status: 400 });
  }
  if (!emailValido(email)) {
    return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
  }
  if (!telefoneValido(telefone)) {
    return NextResponse.json({ error: "Telefone inválido." }, { status: 400 });
  }

  const erroSenha = validarSenha(body.senha);
  if (erroSenha) {
    return NextResponse.json({ error: erroSenha }, { status: 400 });
  }
  if (body.senha !== body.confirmarSenha) {
    return NextResponse.json({ error: "As senhas não são iguais." }, { status: 400 });
  }

  const db = getDb();

  // CPF é a identidade do cliente: se já existe, mandamos entrar em vez de
  // criar outro (e assim ninguém sobrescreve o cadastro de outra pessoa).
  const [existente] = await db.select().from(clientes).where(eq(clientes.cpf, cpf));
  if (existente) {
    return NextResponse.json(
      { error: "Este CPF já tem cadastro. Faça login ou use 'Esqueci minha senha'." },
      { status: 409 }
    );
  }

  const id = crypto.randomUUID();
  await db.insert(clientes).values({
    id,
    nome,
    cpf,
    email,
    senhaHash: await gerarHashSenha(body.senha as string),
    telefone,
    rua: texto(endereco.rua),
    numero: texto(endereco.numero, 20),
    bairro: texto(endereco.bairro),
    cidade: texto(endereco.cidade),
    cep: texto(endereco.cep, 12),
    complemento: texto(endereco.complemento) || null,
    lat: coordenada(endereco.lat, 90),
    lng: coordenada(endereco.lng, 180),
  });

  // Já entra logado: acabou de provar quem é ao escolher a senha.
  const token = await criarSessaoCliente(process.env.ADMIN_SESSION_SECRET!, id);
  cookies().set(COOKIE_CLIENTE, token, OPCOES_COOKIE);

  return NextResponse.json({ ok: true, id });
}
