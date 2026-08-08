/**
 * Envio de e-mail pelo Resend, chamando a API HTTP direto (sem SDK, pra não
 * carregar mais uma dependência).
 *
 * Variáveis de ambiente:
 *   RESEND_API_KEY  — a chave da conta
 *   EMAIL_REMETENTE — de onde o e-mail sai, ex: "Doceterapia <contato@seudominio.com.br>"
 *   EMAIL_RESPOSTA  — (opcional) pra onde vai a resposta, quando a cliente
 *                     aperta "responder"
 *
 * O Resend só entrega a partir de um domínio verificado, por isso o
 * remetente precisa ser do domínio próprio da loja.
 *
 * Sobre cair no spam: em 08/08/2026 os avisos foram parar na lixeira do
 * Outlook. O que pesa contra, em ordem: faltar DMARC no DNS, remetente do
 * tipo "nao-responda@" (filtro desconfia de endereço que não aceita
 * resposta), e domínio novo, ainda sem reputação. Por isso o `reply_to` —
 * um endereço que responde de verdade conta a favor.
 */

export type ResultadoEnvio = { enviado: boolean; motivo?: string };

export function emailConfigurado(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_REMETENTE);
}

/**
 * O endereço de resposta, só se for utilizável.
 *
 * Aceita tanto "fulano@casa.com" quanto "Camily <fulano@casa.com>", que é
 * como as pessoas costumam escrever. Qualquer outra coisa é ignorada em
 * silêncio: melhor um e-mail sem "responder" do que nenhum e-mail.
 */
function enderecoDeResposta(): string | null {
  const bruto = (process.env.EMAIL_RESPOSTA ?? "").trim();
  if (!bruto) return null;
  const dentroDosSinais = bruto.match(/<([^>]+)>/)?.[1]?.trim();
  const endereco = dentroDosSinais || bruto;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(endereco) ? endereco : null;
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
        // Só vai se estiver configurado E parecer um e-mail de verdade.
        // Este campo é enfeite; o e-mail em si é o que importa — e um valor
        // torto aqui fazia o Resend recusar a mensagem inteira, derrubando
        // até a recuperação de senha. Aconteceu em 08/08/2026.
        ...(enderecoDeResposta() ? { reply_to: enderecoDeResposta() } : {}),
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

/** Moldura comum dos e-mails, pra todos saírem com a cara da loja. */
function moldura(conteudo: string): string {
  return `<div style="font-family:Nunito,Segoe UI,Arial,sans-serif;background:#fdf0ea;padding:32px 16px">
  <div style="max-width:480px;margin:0 auto;background:#fffaf7;border:1px solid #f0c9d3;border-radius:20px;padding:32px;text-align:center">
    <p style="font-size:26px;margin:0 0 4px;color:#a3243c;font-weight:700">doce<span style="color:#e2879b;font-weight:400">terapia</span></p>
    ${conteudo}
    <p style="color:#3b1a1f;opacity:.45;font-size:12px;margin:28px 0 0;border-top:1px solid #f0c9d3;padding-top:16px">
      Doceterapia — doces artesanais da Camily Vilasboa, em Arapongas-PR.<br>Este e-mail é automático, não precisa responder.
    </p>
  </div>
</div>`;
}

/** Modelo do e-mail com o código de redefinição, na identidade da loja. */
export function emailCodigoSenha(nome: string, codigo: string) {
  const texto = `Oi, ${nome}!

Recebemos um pedido para redefinir a senha da sua conta na Doceterapia.

Seu código é: ${codigo}

Ele vale por 15 minutos. Se não foi você que pediu, ignore esta mensagem — sua senha continua a mesma.

Doceterapia — doces artesanais da Camily Vilasboa`;

  const html = moldura(`
    <p style="color:#3b1a1f;font-size:15px;margin:20px 0 8px">Oi, ${nome}! 🍒</p>
    <p style="color:#3b1a1f;opacity:.75;font-size:14px;margin:0 0 24px">
      Recebemos um pedido para redefinir a senha da sua conta.<br>Use o código abaixo:
    </p>
    <p style="font-size:34px;letter-spacing:8px;font-weight:700;color:#a3243c;background:#fdf0ea;border-radius:14px;padding:16px 8px;margin:0">${codigo}</p>
    <p style="color:#3b1a1f;opacity:.6;font-size:13px;margin:24px 0 0">O código vale por 15 minutos.</p>
    <p style="color:#3b1a1f;opacity:.6;font-size:13px;margin:12px 0 0">
      Se não foi você que pediu, pode ignorar este e-mail — sua senha continua a mesma.
    </p>`);

  return { assunto: "Seu código para redefinir a senha - Doceterapia", html, texto };
}

/**
 * Aviso de mudança de situação do pedido. Cada situação tem um texto próprio,
 * escrito como a Camily falaria com a cliente.
 */
export function emailStatusPedido(dados: {
  nome: string;
  status: string;
  tipoEntrega: string;
  itens: Array<{ nome: string; quantidade: number }>;
  total: number;
  prazoEm?: string | null;
  /** Link de acompanhamento da entrega, quando a Camily informou. */
  linkRastreio?: string | null;
  /** Onde a cliente vai buscar, quando o pedido é retirada. */
  pontoRetirada?: string | null;
  /** Como ficou a devolução do dinheiro, quando o pedido foi cancelado. */
  reembolso?: "nao_precisa" | "concluido" | "falhou" | null;
  formaPagamento?: string;
}) {
  const primeiroNome = dados.nome.split(" ")[0];
  const ehEntrega = dados.tipoEntrega === "entrega";
  const receber = ehEntrega ? "entrega" : "retirada";

  // No cancelamento, o que o cliente mais quer saber é do dinheiro. Cada
  // caso merece um texto diferente — prometer estorno pra quem nunca chegou
  // a pagar confunde, e falar "já foi devolvido" quando o estorno falhou é pior.
  const prazoDoEstorno =
    dados.formaPagamento === "pix"
      ? "No Pix o valor costuma cair na conta em alguns minutos."
      : "No cartão o estorno pode aparecer só na próxima fatura, dependendo do banco.";

  const sobreODinheiro =
    dados.reembolso === "concluido"
      ? ` Já pedimos a devolução do valor no Mercado Pago. ${prazoDoEstorno}`
      : dados.reembolso === "falhou"
        ? " A devolução do valor não saiu automaticamente — a Camily já foi avisada e vai resolver isso com você pelo WhatsApp."
        : dados.reembolso === "nao_precisa"
          ? " Como o pagamento ainda não tinha sido concluído, não há nada a devolver."
          : "";

  const textos: Record<string, { assunto: string; titulo: string; corpo: string }> = {
    pago: {
      assunto: "Pagamento confirmado! Seu pedido está garantido 🍒",
      titulo: "Pagamento confirmado!",
      corpo: `Recebemos seu pagamento e seu pedido já está na fila. A Camily vai preparar tudo com carinho e combina os detalhes da ${receber} com você pelo WhatsApp.`,
    },
    em_preparo: {
      assunto: "Seus doces já estão sendo preparados 🍰",
      titulo: "Estamos preparando seus doces",
      corpo: "A Camily começou a preparar seu pedido agorinha. Em breve avisamos quando estiver pronto.",
    },
    a_caminho: {
      assunto: ehEntrega ? "Seu pedido saiu para entrega! 🛵" : "Seu pedido está pronto para retirada! 🍒",
      titulo: ehEntrega ? "Saiu para entrega!" : "Pronto para retirada!",
      corpo: ehEntrega
        ? "Seu pedido acabou de sair e está a caminho do seu endereço. Fique de olho!"
        : // Na retirada este é o e-mail que manda a pessoa sair de casa, então
          // o endereço vai junto — procurar no site nessa hora é atrito à toa.
          `Seus doces estão prontinhos esperando por você.${
            dados.pontoRetirada ? ` Você busca em <strong>${dados.pontoRetirada}</strong>.` : ""
          } É só combinar o horário com a Camily pelo WhatsApp.`,
    },
    concluido: {
      assunto: "Obrigada pelo seu pedido! 💗",
      titulo: "Pedido entregue!",
      corpo: "Esperamos que você adore cada pedacinho. Se gostar, conta pra gente — e volte sempre!",
    },
    cancelado: {
      assunto: "Seu pedido foi cancelado",
      titulo: "Pedido cancelado",
      corpo: `Seu pedido foi cancelado.${sobreODinheiro} Qualquer dúvida, fale com a Camily pelo WhatsApp.`,
    },
  };

  const t = textos[dados.status];
  if (!t) return null; // situação sem aviso (ex: aguardando pagamento)

  const listaTexto = dados.itens
    .map((i) => `- ${i.quantidade}x ${i.nome}`)
    .join("\n");
  const listaHtml = dados.itens
    .map((i) => `<li style="margin:2px 0">${i.quantidade}× ${i.nome}</li>`)
    .join("");

  // Só faz sentido acompanhar quando o pedido saiu de fato para a entrega.
  const rastreio =
    dados.status === "a_caminho" && ehEntrega && dados.linkRastreio
      ? dados.linkRastreio
      : null;

  const texto = `Oi, ${primeiroNome}!

${t.corpo}
${rastreio ? `\nAcompanhe a entrega em tempo real:\n${rastreio}\n` : ""}
Seu pedido:
${listaTexto}
Total: R$ ${dados.total.toFixed(2)}

Doceterapia — doces artesanais da Camily Vilasboa`;

  const html = moldura(`
    <p style="color:#3b1a1f;font-size:19px;margin:20px 0 6px;font-weight:700">${t.titulo}</p>
    <p style="color:#3b1a1f;font-size:15px;margin:0 0 4px">Oi, ${primeiroNome}!</p>
    <p style="color:#3b1a1f;opacity:.75;font-size:14px;margin:12px 0 20px">${t.corpo}</p>
    ${
      rastreio
        ? `<a href="${rastreio}" style="display:inline-block;background:#a3243c;color:#fff;text-decoration:none;font-weight:700;font-size:15px;border-radius:999px;padding:14px 28px;margin:0 0 20px">Acompanhar entrega</a>
    <p style="color:#3b1a1f;opacity:.55;font-size:12px;margin:0 0 20px">Toque no botão para ver onde seu pedido está.</p>`
        : ""
    }
    <div style="background:#fdf0ea;border-radius:14px;padding:16px;text-align:left">
      <p style="margin:0 0 8px;font-size:13px;color:#a3243c;font-weight:700">Seu pedido</p>
      <ul style="margin:0;padding-left:18px;color:#3b1a1f;font-size:14px">${listaHtml}</ul>
      <p style="margin:10px 0 0;font-size:15px;color:#3b1a1f;font-weight:700">Total: R$ ${dados.total.toFixed(2)}</p>
    </div>`);

  return { assunto: t.assunto, html, texto };
}
