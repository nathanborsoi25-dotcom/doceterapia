import { NextResponse } from "next/server";
import { getClienteLogado } from "@/lib/cliente-logado";
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
