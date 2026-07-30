/**
 * Envio de e-mail pelo Resend, chamando a API HTTP direto (sem SDK, pra não
 * carregar mais uma dependência).
 *
 * Precisa de duas variáveis de ambiente:
 *   RESEND_API_KEY  — a chave da conta
 *   EMAIL_REMETENTE — de onde o e-mail sai, ex: "Doceterapia <nao-responda@seudominio.com.br>"
 *
 * O Resend só entrega a partir de um domínio verificado, por isso o
 * remetente precisa ser do domínio próprio da loja.
 */

export type ResultadoEnvio = { enviado: boolean; motivo?: string };

export function emailConfigurado(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_REMETENTE);
}

export async function enviarEmail(opcoes: {
  para: string;
  assunto: string;
  html: string;
  texto: string;
}): Promise<ResultadoEnvio> {
  const chave = process.env.RESEND_API_KEY;
  const remetente = process.env.EMAIL_REMETENTE;

  if (!chave || !remetente) {
    return { enviado: false, motivo: "E-mail ainda não configurado no servidor." };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${chave}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: remetente,
        to: [opcoes.para],
        subject: opcoes.assunto,
        html: opcoes.html,
        text: opcoes.texto,
      }),
    });

    if (!res.ok) {
      // Não devolvemos o corpo do erro pra tela: pode conter detalhe da conta.
      console.error("Resend recusou o envio:", res.status, await res.text());
      return { enviado: false, motivo: "Não foi possível enviar o e-mail." };
    }
    return { enviado: true };
  } catch (e) {
    console.error("Falha de rede ao enviar e-mail:", e);
    return { enviado: false, motivo: "Não foi possível enviar o e-mail." };
  }
}

/** Esconde o meio do e-mail: "maria@gmail.com" -> "ma***@gmail.com". */
export function mascararEmail(email: string): string {
  const [usuario, dominio] = (email ?? "").split("@");
  if (!usuario || !dominio) return "seu e-mail";
  const visivel = usuario.slice(0, Math.min(2, usuario.length));
  return `${visivel}${"*".repeat(3)}@${dominio}`;
}

/** Modelo do e-mail com o código de redefinição, na identidade da loja. */
export function emailCodigoSenha(nome: string, codigo: string) {
  const texto = `Oi, ${nome}!

Recebemos um pedido para redefinir a senha da sua conta na Doceterapia.

Seu código é: ${codigo}

Ele vale por 15 minutos. Se não foi você que pediu, ignore esta mensagem — sua senha continua a mesma.

Doceterapia — doces artesanais da Camily Vilasboa`;

  const html = `<div style="font-family:Nunito,Segoe UI,Arial,sans-serif;background:#fdf0ea;padding:32px 16px">
  <div style="max-width:480px;margin:0 auto;background:#fffaf7;border:1px solid #f0c9d3;border-radius:20px;padding:32px;text-align:center">
    <p style="font-size:26px;margin:0 0 4px;color:#a3243c;font-weight:700">doce<span style="color:#e2879b;font-weight:400">terapia</span></p>
    <p style="color:#3b1a1f;font-size:15px;margin:20px 0 8px">Oi, ${nome}! 🍒</p>
    <p style="color:#3b1a1f;opacity:.75;font-size:14px;margin:0 0 24px">
      Recebemos um pedido para redefinir a senha da sua conta.<br>Use o código abaixo:
    </p>
    <p style="font-size:34px;letter-spacing:8px;font-weight:700;color:#a3243c;background:#fdf0ea;border-radius:14px;padding:16px 8px;margin:0">${codigo}</p>
    <p style="color:#3b1a1f;opacity:.6;font-size:13px;margin:24px 0 0">
      O código vale por 15 minutos.
    </p>
    <p style="color:#3b1a1f;opacity:.6;font-size:13px;margin:12px 0 0">
      Se não foi você que pediu, pode ignorar este e-mail — sua senha continua a mesma.
    </p>
  </div>
</div>`;

  return { assunto: "Seu código para redefinir a senha - Doceterapia", html, texto };
}
