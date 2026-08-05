import { NextResponse } from "next/server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { clientes, codigosSenha } from "@/lib/db/schema";
import { gerarHashSenha } from "@/lib/senha";
import { emailCodigoSenha, enviarEmail } from "@/lib/email";
import { emailValido, normalizarEmail } from "@/lib/validacoes";

export const dynamic = "force-dynamic";

const VALIDADE_MINUTOS = 15;
/** Espera mínima entre dois pedidos, pra não virar máquina de spam. */
const ESPERA_SEGUNDOS = 60;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = normalizarEmail(body.email ?? "");

  // Resposta sempre igual, exista o e-mail ou não: senão daria pra descobrir
  // quem tem conta aqui só testando endereços. É por isso que não devolvemos
  // mais o e-mail de destino — a tela mostra o que a própria pessoa digitou.
  const generico = {
    ok: true,
    mensagem:
      "Se este e-mail tiver uma conta, enviamos um código para ele.",
  };

  if (!emailValido(email)) return NextResponse.json(generico);

  const db = getDb();
  const [cliente] = await db.select().from(clientes).where(eq(clientes.email, email));
  if (!cliente || !cliente.email) return NextResponse.json(generico);

  const agora = new Date();

  // Já pediu agora há pouco? Devolve a mesma resposta sem mandar outro e-mail.
  const [recente] = await db
    .select()
    .from(codigosSenha)
    .where(
      and(
        eq(codigosSenha.clienteId, cliente.id),
        isNull(codigosSenha.usadoEm),
        gt(codigosSenha.criadoEm, new Date(agora.getTime() - ESPERA_SEGUNDOS * 1000))
      )
    );
  if (recente) {
    return NextResponse.json(generico);
  }

  // Um código válido por vez: os anteriores são marcados como usados.
  await db
    .update(codigosSenha)
    .set({ usadoEm: agora })
    .where(and(eq(codigosSenha.clienteId, cliente.id), isNull(codigosSenha.usadoEm)));

  // Código de 6 dígitos sorteado de forma criptográfica.
  const numero = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  const codigo = String(numero).padStart(6, "0");

  await db.insert(codigosSenha).values({
    id: crypto.randomUUID(),
    clienteId: cliente.id,
    // Guardado como hash: se a tabela vazar, o código não serve pra nada.
    codigoHash: await gerarHashSenha(codigo),
    expiraEm: new Date(agora.getTime() + VALIDADE_MINUTOS * 60 * 1000),
  });

  const modelo = emailCodigoSenha(cliente.nome.split(" ")[0], codigo);
  const envio = await enviarEmail({ para: cliente.email, ...modelo });

  if (!envio.enviado) {
    return NextResponse.json(
      {
        error:
          "Não conseguimos enviar o e-mail agora. Fale com a Camily pelo WhatsApp que ela te ajuda a recuperar o acesso.",
      },
      { status: 503 }
    );
  }

  return NextResponse.json(generico);
}
