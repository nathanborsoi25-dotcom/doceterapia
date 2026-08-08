/**
 * Regras de prazo dos pedidos.
 *
 * Doce sob encomenda precisa de dias para ficar pronto, então o prazo do
 * pedido é sempre a data da compra mais o maior prazo entre os doces do
 * carrinho — na entrega e na retirada. Ninguém marca dia nem hora pelo site:
 * quem combina isso com a cliente é a Camily, pelo WhatsApp.
 */

/** Dias de encomenda de um pedido: o maior prazo entre os itens. */
export function prazoMaximoEmDias(
  prazos: Array<number | null | undefined>
): number {
  return prazos.reduce<number>((maior, p) => {
    const dias = Number(p);
    return Number.isFinite(dias) && dias > maior ? dias : maior;
  }, 0);
}

/**
 * O fuso da loja. O servidor da Vercel roda em UTC, e o navegador da Camily
 * em Brasília — sem fixar isto, "hoje" era um dia diferente em cada lado.
 */
const FUSO_DA_LOJA = "America/Sao_Paulo";

/** Que dia é este momento em Arapongas, não importa onde o código rode. */
function diaDeHojeNaLoja(agora: Date): { ano: number; mes: number; dia: number } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_DA_LOJA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
  const [ano, mes, dia] = partes.split("-").map(Number);
  return { ano, mes, dia };
}

/** O mesmo dia, virado em número, pra dar pra subtrair um do outro. */
function diaDoCalendarioNaLoja(data: Date): number {
  const { ano, mes, dia } = diaDeHojeNaLoja(data);
  return Date.UTC(ano, mes - 1, dia);
}

/**
 * Primeiro dia em que o pedido pode estar pronto, contando de hoje.
 *
 * Grava ao MEIO-DIA em UTC de propósito. À meia-noite UTC — como era antes —
 * a data virava 21h do dia ANTERIOR em Brasília, e o painel mostrava
 * "vencido há 1 dia" em pedido feito na mesma tarde. Ao meio-dia sobra folga
 * de 12 horas para os dois lados, então o dia do calendário é o mesmo em
 * qualquer fuso do Brasil.
 */
export function dataMinimaRetirada(prazoDias: number, hoje = new Date()): Date {
  const { ano, mes, dia } = diaDeHojeNaLoja(hoje);
  return new Date(Date.UTC(ano, mes - 1, dia + prazoDias, 12, 0, 0));
}

export type SituacaoPrazo = {
  /** Dias que faltam: 0 é hoje, negativo é atrasado. */
  diasRestantes: number;
  vencido: boolean;
  /** Texto pronto para a tela: "3 dias", "hoje", "vencido há 2 dias". */
  rotulo: string;
};

/**
 * Traduz o prazo em algo que a Camily entende de relance. Como conta dias de
 * calendário (e não horas), o rótulo muda sozinho de um dia para o outro:
 * um pedido para 05/08 mostra "7 dias" em 29/07 e "6 dias" em 30/07.
 */
export function situacaoPrazo(
  prazoEm: string | Date | null | undefined,
  opcoes: { encerrado?: boolean; hoje?: Date } = {}
): SituacaoPrazo | null {
  if (!prazoEm) return null;

  const data = new Date(prazoEm);
  if (Number.isNaN(data.getTime())) return null;

  // Os dois lados contados pelo calendário de Arapongas: assim a conta dá o
  // mesmo resultado no navegador da Camily e no servidor, que roda em UTC.
  const prazo = diaDoCalendarioNaLoja(data);
  const hoje = diaDoCalendarioNaLoja(opcoes.hoje ?? new Date());
  const DIA = 24 * 60 * 60 * 1000;
  const diasRestantes = Math.round((prazo - hoje) / DIA);

  // Pedido já concluído ou cancelado não fica "vencido" para sempre.
  const vencido = !opcoes.encerrado && diasRestantes < 0;

  let rotulo: string;
  if (diasRestantes < 0) {
    const atraso = Math.abs(diasRestantes);
    rotulo = opcoes.encerrado
      ? "encerrado"
      : `vencido há ${atraso} ${atraso === 1 ? "dia" : "dias"}`;
  } else if (diasRestantes === 0) {
    rotulo = "é hoje";
  } else if (diasRestantes === 1) {
    rotulo = "amanhã";
  } else {
    rotulo = `${diasRestantes} dias`;
  }

  return { diasRestantes, vencido, rotulo };
}
