import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

/**
 * Por que o e-mail não está saindo.
 *
 * Quando o Resend recusa um envio, o motivo fica só no log do servidor — e o
 * cliente recebe um "não consegui enviar" sem explicação. Em 08/08/2026 os
 * e-mails pararam depois de mexer no remetente, e não havia como saber o
 * motivo sem acesso aos logs da Vercel.
 *
 * Esta rota conta o que está acontecendo. Só o admin logado pode ver, e ela
 * NUNCA devolve a chave da API — só o formato do que está configurado e a
 * resposta do Resend.
 */
export async function GET(req: Request) {
  const negado = await requireAdmin();
  if (negado) return negado;

  const chave = process.env.RESEND_API_KEY;
  const remetente = process.env.EMAIL_REMETENTE;
  const resposta = process.env.EMAIL_RESPOSTA;

  const config = {
    temChave: Boolean(chave),
    /** Só o comecinho, pra dar pra conferir que é a chave certa. */
    chaveComecaCom: chave ? `${chave.slice(0, 6)}…` : null,
    remetente: remetente ?? null,
    emailDeResposta: resposta ?? null,
  };

  if (!chave || !remetente) {
    return NextResponse.json({
      config,
      diagnostico: "Falta RESEND_API_KEY ou EMAIL_REMETENTE nas variáveis.",
    });
  }

  // Para onde mandar o teste: quem chamou pode passar ?para=..., senão vai
  // para o próprio remetente.
  const para =
    new URL(req.url).searchParams.get("para") ||
    remetente.match(/<(.+)>/)?.[1] ||
    remetente;

  const resposta_ = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${chave}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: remetente,
      to: [para],
      subject: "Teste de envio — Doceterapia",
      html: "<p>Se este e-mail chegou, o envio está funcionando. 🍒</p>",
      text: "Se este e-mail chegou, o envio está funcionando.",
      ...(resposta ? { reply_to: resposta } : {}),
    }),
  });

  const corpo = await resposta_.text();

  return NextResponse.json({
    config,
    enviadoPara: para,
    resend: {
      status: resposta_.status,
      ok: resposta_.ok,
      // A resposta do Resend diz exatamente o que ele não aceitou.
      corpo: corpo.slice(0, 800),
    },
  });
}
