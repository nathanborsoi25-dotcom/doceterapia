/**
 * Regras de prazo dos pedidos.
 *
 * Doce sob encomenda precisa de dias para ficar pronto, então:
 *  - na RETIRADA, o cliente só pode agendar a partir de hoje + o maior prazo
 *    entre os doces do carrinho;
 *  - na ENTREGA, o cliente não agenda (quem marca é a Camily), e o prazo do
 *    pedido é a data da compra mais esse mesmo número de dias.
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

/** Sempre meia-noite: prazo é dia, não hora. */
function inicioDoDia(data: Date): Date {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Primeira data possível para retirada, a partir de hoje. */
export function dataMinimaRetirada(prazoDias: number, hoje = new Date()): Date {
  const d = inicioDoDia(hoje);
  d.setDate(d.getDate() + prazoDias);
  return d;
}

/** Formato aceito pelo input datetime-local: "2026-08-05T09:00". */
export function paraInputDataHora(data: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}T${p(
    data.getHours()
  )}:${p(data.getMinutes())}`;
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

  const prazo = inicioDoDia(new Date(prazoEm));
  if (Number.isNaN(prazo.getTime())) return null;

  const hoje = inicioDoDia(opcoes.hoje ?? new Date());
  const DIA = 24 * 60 * 60 * 1000;
  const diasRestantes = Math.round((prazo.getTime() - hoje.getTime()) / DIA);

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
