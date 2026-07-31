import { NextResponse } from "next/server";
import { apenasDigitos } from "@/lib/validacoes";

export const dynamic = "force-dynamic";

/**
 * Busca o endereço a partir do CEP no ViaCEP (serviço público e gratuito).
 * Passa pelo nosso servidor em vez de o navegador chamar direto, pra não
 * depender da política de CORS deles e pra tratar o erro sempre igual.
 */
export async function GET(req: Request) {
  const cep = apenasDigitos(new URL(req.url).searchParams.get("cep") ?? "");

  if (cep.length !== 8) {
    return NextResponse.json({ erro: "CEP incompleto." }, { status: 400 });
  }

  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`ViaCEP respondeu ${res.status}`);

    const dados = (await res.json()) as {
      erro?: boolean | string;
      logradouro?: string;
      bairro?: string;
      localidade?: string;
      uf?: string;
    };

    // O ViaCEP responde 200 com {"erro": true} quando o CEP não existe.
    if (dados.erro) {
      return NextResponse.json({ erro: "CEP não encontrado." }, { status: 404 });
    }

    return NextResponse.json({
      rua: dados.logradouro ?? "",
      bairro: dados.bairro ?? "",
      cidade: dados.localidade ?? "",
      uf: dados.uf ?? "",
    });
  } catch (e) {
    console.error("Falha ao consultar o CEP:", e);
    return NextResponse.json(
      { erro: "Não foi possível buscar o CEP agora." },
      { status: 503 }
    );
  }
}
