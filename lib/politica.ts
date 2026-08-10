/**
 * O texto da página de política, editável pela Camily em `/admin/politica`.
 *
 * Cada bloco é um pedaço de TEXTO PURO. Os links (WhatsApp, Minha conta) e a
 * estrutura da página ficam no código, e não no que ela digita: assim ela
 * reescreve o que quiser sem risco de quebrar a página nem de deixar um link
 * apontando pro lugar errado.
 *
 * O que ela não editar cai no padrão daqui — a página nunca aparece vazia.
 */

export type ChavePolitica =
  | "intro"
  | "cancelamentoIntro"
  | "etapaAguardando"
  | "etapaPreparo"
  | "etapaEntregue"
  | "devolucao"
  | "prazosDoEstorno"
  | "entregaRetirada"
  | "sobEncomenda"
  | "pagamento"
  | "dados"
  | "avaliacoes";

export const POLITICA_PADRAO: Record<ChavePolitica, string> = {
  intro:
    "Quero que você compre com tranquilidade, sabendo direitinho o que acontece em cada situação. Por isso deixei tudo combinado por escrito aqui embaixo.",

  cancelamentoIntro:
    "Seu pedido passa por algumas etapas até chegar até você, e o que dá para fazer em cada uma delas muda um pouquinho. De um modo geral: enquanto os doces ainda não saíram da minha cozinha, dá para cancelar e receber o valor de volta.",

  etapaAguardando:
    "Nessa fase você mesma pode cancelar, na hora, sem precisar falar comigo. Se o pagamento já tiver sido feito, devolvo o valor integral.",

  etapaPreparo:
    "Seus doces já estão sendo preparados, então o cancelamento passa por mim — mas ainda é possível. É só me chamar que eu cuido do cancelamento e da devolução do valor.",

  etapaEntregue:
    "Aqui os doces já saíram para entrega, ou já estão prontinhos esperando por você. Como é alimento fresco, feito sob medida para o seu pedido, a partir desse momento não consigo mais aceitar cancelamento nem devolução.\n\nMas fique tranquila: se alguma coisa chegar diferente do que a gente combinou, me mande uma mensagem no mesmo dia, de preferência com uma foto. Eu olho cada caso com carinho e a gente encontra uma solução juntas.",

  devolucao:
    "Nos casos em que o cancelamento vale, o pedido de estorno vai para o Mercado Pago na mesma hora, pelo valor total — doces e entrega, descontando o cupom que tiver sido usado. Você não precisa pedir nada: sai junto com o cancelamento.",

  prazosDoEstorno:
    "- Pix: o valor costuma voltar para a sua conta em minutos, e no máximo em alguns dias úteis.\n- Cartão de crédito: o estorno aparece na fatura. Dependendo da data de fechamento, pode ser só na fatura seguinte — quem define esse prazo é o banco, não eu.\n\nSe por algum motivo o estorno automático não sair, eu sou avisada na hora e falo com você para devolver por Pix.",

  entregaRetirada:
    "Entrega: por enquanto entrego somente em Arapongas-PR (CEPs de 86700-000 a 86709-999). O valor é calculado pela distância entre a minha cozinha e o seu endereço, e aparece no carrinho antes de você pagar. A entrega é feita por aplicativo, e o dia e o horário eu combino com você.\n\nRetirada: você escolhe no site onde prefere buscar, entre os endereços disponíveis, e não tem custo nenhum. O dia e o horário a gente combina depois que o pagamento é confirmado.",

  sobEncomenda:
    "Cada doce mostra no cardápio se é de pronta entrega ou sob encomenda e, nesse caso, de quantos dias eu preciso para preparar. Se o seu carrinho tiver mais de um doce sob encomenda, vale o maior prazo entre eles, porque tudo sai junto.",

  pagamento:
    "O pagamento é pelo Mercado Pago, com Pix ou cartão de crédito à vista. Não trabalho com boleto nem com parcelamento. Os dados do seu cartão são digitados no ambiente do Mercado Pago — eu não vejo e não guardo nada disso.\n\nO pedido entra na fila depois que o pagamento é confirmado. Você recebe um e-mail a cada mudança: pagamento confirmado, em preparo, a caminho e entregue.",

  dados:
    "Guardo apenas o necessário para vender e entregar: nome, e-mail, telefone e endereço. Não peço CPF. Sua senha fica guardada de forma embaralhada, então nem eu consigo vê-la. Não vendo nem compartilho seus dados com ninguém. Se quiser que eu apague seu cadastro, é só pedir.",

  avaliacoes:
    "Só quem comprou e recebeu o pedido pode avaliar, e a nota é por doce. Sua avaliação aparece no cardápio na hora, com o seu primeiro nome. Não apago avaliação por ser negativa — escondo apenas mensagem ofensiva ou que não tem a ver com o pedido.",
};

/** O que a tela do painel mostra pra Camily, na ordem em que ela vai ler. */
export const CAMPOS_POLITICA: Array<{
  chave: ChavePolitica;
  rotulo: string;
  ajuda: string;
}> = [
  {
    chave: "intro",
    rotulo: "Abertura da página",
    ajuda: "As primeiras linhas, logo abaixo do título.",
  },
  {
    chave: "cancelamentoIntro",
    rotulo: "Cancelamento — abertura",
    ajuda: "Explica a ideia geral antes das três etapas.",
  },
  {
    chave: "etapaAguardando",
    rotulo: "Etapa: aguardando pagamento ou pago",
    ajuda: "Quando a cliente ainda cancela sozinha pelo site.",
  },
  {
    chave: "etapaPreparo",
    rotulo: "Etapa: em preparo",
    ajuda: "Quando o cancelamento passa por você.",
  },
  {
    chave: "etapaEntregue",
    rotulo: "Etapa: a caminho ou entregue",
    ajuda: "Quando não há mais cancelamento nem devolução.",
  },
  {
    chave: "devolucao",
    rotulo: "Devolução do dinheiro",
    ajuda: "Como funciona o estorno.",
  },
  {
    chave: "prazosDoEstorno",
    rotulo: "Prazos do estorno",
    ajuda: "Linhas começando com “- ” viram uma lista com bolinhas.",
  },
  {
    chave: "entregaRetirada",
    rotulo: "Entrega e retirada",
    ajuda: "Onde você entrega, quanto custa e como funciona a retirada.",
  },
  {
    chave: "sobEncomenda",
    rotulo: "Doces sob encomenda",
    ajuda: "Como funcionam os prazos de preparo.",
  },
  { chave: "pagamento", rotulo: "Formas de pagamento", ajuda: "Pix e crédito à vista." },
  { chave: "dados", rotulo: "Seus dados", ajuda: "O que você guarda da cliente." },
  { chave: "avaliacoes", rotulo: "Avaliações", ajuda: "Quem pode avaliar e o que você esconde." },
];

/**
 * Junta o que a Camily salvou com o padrão. Campo em branco volta pro texto
 * de fábrica — apagar tudo por engano não deixa a página com um buraco.
 */
export function textosDaPolitica(
  salvo: Partial<Record<ChavePolitica, string>> | null | undefined
): Record<ChavePolitica, string> {
  const resultado = { ...POLITICA_PADRAO };
  for (const { chave } of CAMPOS_POLITICA) {
    const valor = salvo?.[chave];
    if (typeof valor === "string" && valor.trim()) resultado[chave] = valor.trim();
  }
  return resultado;
}
