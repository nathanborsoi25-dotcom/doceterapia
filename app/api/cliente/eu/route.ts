import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { clientes } from "@/lib/db/schema";
import { getClienteLogado } from "@/lib/cliente-logado";
import { emailValido, telefoneValido } from "@/lib/validacoes";
import type { Cliente } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Dados do cliente logado, para as telas montarem o checkout e o cabeçalho. */
export async function GET() {
  const c = await getClienteLogado();
  if (!c) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const cliente: Cliente = {
    id: c.id,
    nome: c.nome,
    cpf: c.cpf,
    telefone: c.telefone,
    endereco: {
      rua: c.rua,
      numero: c.numero,
      bairro: c.bairro,
      cidade: c.cidade,
      cep: c.cep,
      complemento: c.complemento ?? undefined,
      lat: c.lat ?? undefined,
      lng: c.lng ?? undefined,
    },
    criadoEm: c.criadoEm.toISOString(),
  };
  // A senha (hash) nunca sai daqui.
  return NextResponse.json({ ...cliente, email: c.email });
}

function texto(valor: unknown, limite = 120): string {
  return typeof valor === "string" ? valor.trim().slice(0, limite) : "";
}

function coordenada(valor: unknown, max: number): number | null {
  const n = Number(valor);
  return Number.isFinite(n) && Math.abs(n) <= max ? n : null;
}

/**
 * O cliente editando os próprios dados na tela "Minha conta".
 *
 * Quem está sendo editado sai da SESSÃO — o navegador não manda id nenhum.
 * O CPF e a senha ficam de fora de propósito: o CPF é a identidade de quem
 * entra no site, e senha se troca pelo "esqueci minha senha".
 */
export async function PUT(req: Request) {
  const atual = await getClienteLogado();
  if (!atual) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, any> | null;
  if (!body) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const nome = texto(body.nome);
  const email = texto(body.email).toLowerCase();
  const telefone = texto(body.telefone, 30);
  const endereco = body.endereco ?? {};

  if (!nome) {
    return NextResponse.json({ error: "Informe seu nome completo." }, { status: 400 });
  }
  if (!emailValido(email)) {
    return NextResponse.json(
      { error: "Informe um e-mail válido — é por ele que você recupera a senha." },
      { status: 400 }
    );
  }
  if (!telefoneValido(telefone)) {
    return NextResponse.json({ error: "Informe um telefone com DDD." }, { status: 400 });
  }
  if (!texto(endereco.rua) || !texto(endereco.numero, 20) || !texto(endereco.cep, 12)) {
    return NextResponse.json(
      { error: "Preencha o endereço (rua, número e CEP)." },
      { status: 400 }
    );
  }

  await getDb()
    .update(clientes)
    .set({
      nome,
      email,
      telefone,
      rua: texto(endereco.rua),
      numero: texto(endereco.numero, 20),
      bairro: texto(endereco.bairro),
      cidade: texto(endereco.cidade),
      cep: texto(endereco.cep, 12),
      complemento: texto(endereco.complemento) || null,
      // Sem coordenadas novas, mantém as antigas: perder o lat/lng deixaria o
      // frete sem como ser calculado no próximo pedido.
      lat: coordenada(endereco.lat, 90) ?? atual.lat,
      lng: coordenada(endereco.lng, 180) ?? atual.lng,
    })
    .where(eq(clientes.id, atual.id));

  return NextResponse.json({ ok: true });
}
