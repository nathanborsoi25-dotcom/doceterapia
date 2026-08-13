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
 * Um endereço solto, sem nome. Os sinais `<` e `>` ficam de fora de
 * propósito: sem isso, "<contato@casa.com>" passava como se fosse um e-mail
 * puro e ia torto pro Resend — foi assim que o site ficou mudo.
 */
const PARECE_EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;

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
  return PARECE_EMAIL.test(endereco) ? endereco : null;
}

/**
 * O remetente no formato que o Resend exige: "e-mail" ou "Nome <e-mail>".
 *
 * Em 08/08/2026 a variável foi salva como "<contato@doceterapia.net.br>" — os
 * sinais sem o nome antes — e o Resend recusou TODOS os envios com
 * "Invalid `from` field", derrubando até a recuperação de senha. Como o nome
 * da loja é sempre o mesmo, dá pra remontar em vez de deixar o site mudo por
 * causa de um "<" sobrando.
 */
function remetenteValido(bruto: string): string | null {
  const valor = bruto.trim();
  if (!valor) return null;

  // Já está certo: "fulano@casa.com" ou "Nome <fulano@casa.com>".
  if (PARECE_EMAIL.test(valor)) return valor;
  if (/^[^<>]+<[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}>$/.test(valor)) return valor;

  // Sobrou só o endereço entre sinais: devolve com o nome da loja na frente.
  const dentroDosSinais = valor.match(/<([^>]+)>/)?.[1]?.trim();
  if (dentroDosSinais && PARECE_EMAIL.test(dentroDosSinais)) {
    return `Doceterapia <${dentroDosSinais}>`;
  }
  return null;
}

export async function enviarEmail(opcoes: {
  para: string;
  assunto: string;
  html: string;
  texto: string;
}): Promise<ResultadoEnvio> {
  const chave = process.env.RESEND_API_KEY;
  const remetente = remetenteValido(process.env.EMAIL_REMETENTE ?? "");

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

/**
 * Moldura comum dos e-mails, pra todos saírem com a cara da loja.
 *
 * O rodapé CONVIDA a responder de propósito. Antes dizia "este e-mail é
 * automático, não precisa responder" — o que virou mentira quando passou a
 * existir um endereço de resposta de verdade, e é exatamente o padrão que
 * filtro de spam associa a disparo em massa. Conversa que tem volta pesa a
 * favor de quem manda.
 */
function moldura(conteudo: string, rodape?: string): string {
  return `<div style="font-family:Nunito,Segoe UI,Arial,sans-serif;background:#fdf0ea;padding:32px 16px">
  <div style="max-width:480px;margin:0 auto;background:#fffaf7;border:1px solid #f0c9d3;border-radius:20px;padding:32px;text-align:center">
    <p style="font-size:26px;margin:0 0 4px;color:#a3243c;font-weight:700">doce<span style="color:#e2879b;font-weight:400">terapia</span></p>
    ${conteudo}
    <p style="color:#3b1a1f;opacity:.45;font-size:12px;margin:28px 0 0;border-top:1px solid #f0c9d3;padding-top:16px">
      ${
        rodape ??
        "Doceterapia — doces artesanais da Camily Vilasboa, em Arapongas-PR.<br>Precisa de alguma coisa? É só responder este e-mail que eu leio."
      }
    </p>
  </div>
</div>`;
}

/**
 * Pra onde vão os avisos de venda — a caixa da Camily, não a da cliente.
 *
 * Cai em `EMAIL_RESPOSTA` quando `EMAIL_LOJA` não existe: aquele já é o
 * endereço dela (é pra lá que as respostas das clientes vão), então o aviso
 * funciona sem precisar criar variável nova na Vercel. Quando ela quiser
 * separar as duas caixas, é só definir `EMAIL_LOJA`.
 */
export function emailDaLoja(): string | null {
  for (const bruto of [process.env.EMAIL_LOJA, process.env.EMAIL_RESPOSTA]) {
    const valor = (bruto ?? "").trim();
    if (!valor) continue;
    const endereco = valor.match(/<([^>]+)>/)?.[1]?.trim() || valor;
    if (PARECE_EMAIL.test(endereco)) return endereco;
  }
  return null;
}

/**
 * Aviso de venda, pra Camily.
 *
 * Antes disto, o pagamento caía e o site não contava pra ninguém: ela só
 * descobria a venda se abrisse o painel por conta própria. Numa loja de uma
 * pessoa só, isso é encomenda parada esperando alguém lembrar de olhar.
 *
 * O e-mail traz tudo que ela precisa pra COMEÇAR a produzir sem abrir o
 * painel — o que fazer, pra quando, pra onde e o telefone de quem comprou.
 */
export function emailVendaNova(dados: {
  clienteNome: string;
  clienteTelefone?: string | null;
  itens: Array<{ nome: string; quantidade: number; saborNome?: string | null }>;
  total: number;
  formaPagamento?: string;
  tipoEntrega: string;
  enderecoEntrega?: string | null;
  pontoRetirada?: string | null;
  prazoEm?: string | null;
  ehPresente?: boolean;
  nomeQuemRecebe?: string | null;
  bilhete?: string | null;
}) {
  const ehEntrega = dados.tipoEntrega === "entrega";
  const forma = dados.formaPagamento === "credito" ? "cartão de crédito" : "Pix";
  const valor = `R$ ${dados.total.toFixed(2).replace(".", ",")}`;

  const prazo = dados.prazoEm
    ? new Date(dados.prazoEm).toLocaleDateString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
      })
    : null;

  const comoRecebe = ehEntrega
    ? `Entrega em ${dados.enderecoEntrega || "endereço não informado"}`
    : `Retirada em ${dados.pontoRetirada || "ponto não informado"}`;

  const linhas = dados.itens.map(
    (i) => `${i.quantidade}× ${i.nome}${i.saborNome ? ` (${i.saborNome})` : ""}`
  );

  const presente = dados.ehPresente
    ? `Presente para ${dados.nomeQuemRecebe || "outra pessoa"}.${
        dados.bilhete ? ` Bilhete: "${dados.bilhete}"` : ""
      }`
    : null;

  const texto = `Entrou uma venda no site!

Cliente: ${dados.clienteNome}${dados.clienteTelefone ? ` — ${dados.clienteTelefone}` : ""}
Pago com ${forma}. Total: ${valor}

Pedido:
${linhas.map((l) => `- ${l}`).join("\n")}

${comoRecebe}${prazo ? `\nPrecisa estar pronto até ${prazo}` : ""}${presente ? `\n${presente}` : ""}

Abra o painel para ver tudo: https://doceterapia.net.br/admin/pedidos`;

  const html = moldura(
    `
    <p style="color:#3b1a1f;font-size:19px;margin:20px 0 6px;font-weight:700">Entrou uma venda! 🍒</p>
    <p style="color:#3b1a1f;opacity:.75;font-size:14px;margin:8px 0 20px">
      <strong>${dados.clienteNome}</strong> acabou de pagar ${valor} com ${forma}.
    </p>

    <div style="background:#fdf0ea;border-radius:14px;padding:16px;text-align:left">
      <p style="margin:0 0 8px;font-size:13px;color:#a3243c;font-weight:700">O que fazer</p>
      <ul style="margin:0;padding-left:18px;color:#3b1a1f;font-size:14px">
        ${linhas.map((l) => `<li style="margin:2px 0">${l}</li>`).join("")}
      </ul>
      <p style="margin:12px 0 0;font-size:14px;color:#3b1a1f"><strong>${comoRecebe}</strong></p>
      ${
        prazo
          ? `<p style="margin:6px 0 0;font-size:14px;color:#a3243c;font-weight:700">Pronto até ${prazo}</p>`
          : ""
      }
      ${
        dados.clienteTelefone
          ? `<p style="margin:6px 0 0;font-size:14px;color:#3b1a1f">Telefone: ${dados.clienteTelefone}</p>`
          : ""
      }
      ${
        presente
          ? `<p style="margin:10px 0 0;font-size:13px;color:#3b1a1f;opacity:.8">🎁 ${presente}</p>`
          : ""
      }
    </div>

    <a href="https://doceterapia.net.br/admin/pedidos" style="display:inline-block;background:#a3243c;color:#fff;text-decoration:none;font-weight:700;font-size:15px;border-radius:999px;padding:14px 28px;margin:20px 0 0">Abrir o painel</a>`,
    "Aviso automático do site da Doceterapia, só para a Camily."
  );

  return {
    assunto: `Venda nova: ${valor} — ${dados.clienteNome.split(" ")[0]} 🍒`,
    html,
    texto,
  };
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
