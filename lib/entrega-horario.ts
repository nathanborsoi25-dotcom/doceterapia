import { FUSO, horaEmBrasilia } from "./funcionamento";
import { diaDaSemanaEmBrasilia, ehFimDeSemana } from "./shipping";

/**
 * O horário em que a ENTREGA acontece — que não é o mesmo em que a loja
 * aceita pedido.
 *
 * A loja recebe encomenda das 9h às 22h todos os dias, mas quem entrega é a
 * Camily, e ela só roda a cidade até as 16h30 nos dias de semana. Sem essa
 * distinção, quem comprasse um doce de pronta entrega às 20h de uma terça
 * ficava esperando por uma entrega que não ia sair naquele dia — e descobria
 * isso só no WhatsApp, depois de pagar.
 *
 * ⚠️ O relógio é SEMPRE o de Brasília. A Vercel roda em UTC, e às 21h de
 * sábado lá já é domingo: o horário do fim de semana valeria no dia errado.
 * Mesmo tropeço de `lib/prazo.ts` e `lib/funcionamento.ts`.
 */

export type FaixaDeEntrega = {
  /** "09:00" */
  abre: string;
  /** "16:30" */
  fecha: string;
};

export type HorarioDeEntrega = {
  /** Segunda a sexta. */
  semana: FaixaDeEntrega;
  /** Sábado e domingo. */
  fimDeSemana: FaixaDeEntrega;
  /** Desligado, o site não avisa nada sobre horário de entrega. */
  ativo: boolean;
};

/** O que a Camily combinou, e vale enquanto ela não mexer no painel. */
export const ENTREGA_PADRAO: HorarioDeEntrega = {
  semana: { abre: "09:00", fecha: "16:30" },
  fimDeSemana: { abre: "09:00", fecha: "22:00" },
  ativo: true,
};

/** "16:30" → 990 minutos. Valor torto vira o padrão. */
export function emMinutos(hhmm: string, padrao = 0): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm ?? "").trim());
  if (!m) return padrao;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return padrao;
  return h * 60 + min;
}

/** 990 → "16:30". */
export function emTexto(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "16:30" → "16h30" · "09:00" → "9h" — do jeito que se fala. */
export function horaFalada(hhmm: string): string {
  const min = emMinutos(hhmm);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

/** Deixa o que vem do banco dentro do que faz sentido. */
export function limparHorarioDeEntrega(v: unknown): HorarioDeEntrega {
  const b = (v ?? {}) as Record<string, unknown>;
  const faixa = (bruta: unknown, padrao: FaixaDeEntrega): FaixaDeEntrega => {
    const f = (bruta ?? {}) as Record<string, unknown>;
    return {
      abre: emTexto(emMinutos(String(f.abre ?? ""), emMinutos(padrao.abre))),
      fecha: emTexto(emMinutos(String(f.fecha ?? ""), emMinutos(padrao.fecha))),
    };
  };
  return {
    semana: faixa(b.semana, ENTREGA_PADRAO.semana),
    fimDeSemana: faixa(b.fimDeSemana, ENTREGA_PADRAO.fimDeSemana),
    ativo: b.ativo !== false,
  };
}

/** A faixa que vale no dia de hoje. */
export function faixaDoDia(
  horario: HorarioDeEntrega,
  agora = new Date()
): FaixaDeEntrega {
  return ehFimDeSemana(agora) ? horario.fimDeSemana : horario.semana;
}

/**
 * Ainda dá tempo de sair entrega hoje?
 *
 * Antes da abertura também é `false` — mas aí o pedido sai HOJE mesmo, e quem
 * diz isso é `entregaSaiHoje`.
 */
export function dentroDoHorarioDeEntrega(
  horario: HorarioDeEntrega,
  agora = new Date()
): boolean {
  if (!horario.ativo) return true;
  const { hora, minuto } = horaEmBrasilia(agora);
  const f = faixaDoDia(horario, agora);
  const agoraMin = hora * 60 + minuto;
  return agoraMin >= emMinutos(f.abre) && agoraMin <= emMinutos(f.fecha);
}

/**
 * O doce de pronta entrega comprado agora ainda sai hoje?
 *
 * Só é `false` depois que a janela FECHOU. Quem compra às 7h da manhã ainda
 * pega a entrega do dia — a janela nem começou.
 */
export function entregaSaiHoje(
  horario: HorarioDeEntrega,
  agora = new Date()
): boolean {
  if (!horario.ativo) return true;
  const { hora, minuto } = horaEmBrasilia(agora);
  return hora * 60 + minuto <= emMinutos(faixaDoDia(horario, agora).fecha);
}

const DIAS = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

/** O nome do dia seguinte, em Brasília. */
export function nomeDoProximoDia(agora = new Date()): string {
  const amanha = new Date(agora.getTime() + 24 * 60 * 60 * 1000);
  return DIAS[diaDaSemanaEmBrasilia(amanha)];
}

/** "Segunda a sexta, das 9h às 16h30 · Sábado e domingo, das 9h às 22h" */
export function horarioDeEntregaEscrito(horario: HorarioDeEntrega): string {
  const s = horario.semana;
  const f = horario.fimDeSemana;
  return `Segunda a sexta, das ${horaFalada(s.abre)} às ${horaFalada(
    s.fecha
  )} · Sábado e domingo, das ${horaFalada(f.abre)} às ${horaFalada(f.fecha)}`;
}

/**
 * O aviso pra quem está comprando agora — ou `null` quando não há o que
 * avisar (a entrega de hoje ainda sai).
 *
 * Fala só do que muda pra ela: em que dia o doce chega. Repetir a tabela de
 * horários aqui só faria a pessoa procurar a informação dentro do texto.
 */
export function avisoDeEntregaHoje(
  horario: HorarioDeEntrega,
  agora = new Date()
): string | null {
  if (!horario.ativo || entregaSaiHoje(horario, agora)) return null;

  const f = faixaDoDia(horario, agora);
  return `As entregas de hoje já encerraram (vão até ${horaFalada(
    f.fecha
  )}). Seu pedido fica garantido e a Camily entrega ${nomeDoProximoDia(
    agora
  )} — ela combina o horário com você pelo WhatsApp.`;
}

export { FUSO };
