/**
 * O horário em que a loja aceita pedido.
 *
 * Fora dele o site não deixa fechar a compra. Não é frescura de tela: pedido
 * que entra às 3 da manhã fica horas parado esperando a Camily acordar, e a
 * cliente acha que o site travou.
 *
 * ⚠️ A hora é SEMPRE a de Brasília, nunca a do servidor. A Vercel roda em
 * UTC, e às 22h de Brasília lá já é 1h do dia seguinte — a loja fecharia três
 * horas antes. É o mesmo tropeço que já derrubou o prazo dos pedidos uma vez
 * (ver `lib/prazo.ts`).
 */

export const FUSO = "America/Sao_Paulo";

/** O que vale enquanto a Camily não mexer no painel. */
export const FUNCIONAMENTO_PADRAO = {
  /** Hora em que abre, de 0 a 23. Às 9h já dá pra comprar. */
  abreAs: 9,
  /**
   * Hora em que fecha. Com 22, o último instante aceito é **22:00** — às
   * 22:01 o site já recusa. É o que o dono pediu, e é como qualquer loja
   * anuncia: "das 9h às 22h" não quer dizer que às 22h50 ainda atende.
   */
  fechaAs: 22,
  /** Desligado, a loja aceita pedido a qualquer hora. */
  ativo: true,
};

export type Funcionamento = typeof FUNCIONAMENTO_PADRAO;

/** Deixa os valores dentro do que faz sentido antes de gravar ou usar. */
export function limparFuncionamento(v: unknown): Funcionamento {
  const b = (v ?? {}) as Record<string, unknown>;
  const hora = (valor: unknown, padrao: number) => {
    const n = Math.floor(Number(valor));
    return Number.isFinite(n) && n >= 0 && n <= 23 ? n : padrao;
  };
  return {
    abreAs: hora(b.abreAs, FUNCIONAMENTO_PADRAO.abreAs),
    fechaAs: hora(b.fechaAs, FUNCIONAMENTO_PADRAO.fechaAs),
    ativo: b.ativo !== false,
  };
}

/** Que horas são AGORA em Brasília, com minutos. */
export function horaEmBrasilia(agora = new Date()): { hora: number; minuto: number } {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(agora);

  const pegar = (tipo: string) =>
    Number(partes.find((p) => p.type === tipo)?.value ?? "0");

  return { hora: pegar("hour") % 24, minuto: pegar("minute") };
}

/**
 * A loja está aberta agora?
 *
 * O horário é o mesmo todos os dias — a Camily atende de segunda a segunda.
 *
 * A conta é feita em MINUTOS, não em horas cheias: "fecha às 22h" precisa
 * recusar 22:01, e comparar só a hora deixaria a loja aberta até 22:59 — uma
 * hora a mais do que ela anuncia.
 */
export function lojaAberta(
  funcionamento: Funcionamento,
  agora = new Date()
): boolean {
  const f = limparFuncionamento(funcionamento);
  if (!f.ativo) return true;

  const { hora, minuto } = horaEmBrasilia(agora);
  const agoraEmMinutos = hora * 60 + minuto;
  const abre = f.abreAs * 60;
  const fecha = f.fechaAs * 60;

  // Horário que vira a noite (ex: abre 18h, fecha 2h): aberto nas duas pontas.
  if (fecha < abre) return agoraEmMinutos >= abre || agoraEmMinutos <= fecha;

  return agoraEmMinutos >= abre && agoraEmMinutos <= fecha;
}

/** "9h" / "22h" — hora cheia, do jeito que se lê. */
function porExtenso(hora: number): string {
  return `${hora}h`;
}

/** "Das 9h às 22h, todos os dias" — pra escrever na tela. */
export function horarioEscrito(funcionamento: Funcionamento): string {
  const f = limparFuncionamento(funcionamento);
  return `Das ${porExtenso(f.abreAs)} às ${porExtenso(f.fechaAs)}, todos os dias`;
}

/**
 * O aviso de loja fechada, já dizendo quando ela abre. Dizer só "estamos
 * fechados" deixa a pessoa sem saber se volta em uma hora ou amanhã.
 */
export function avisoDeFechada(
  funcionamento: Funcionamento,
  agora = new Date()
): string {
  const f = limparFuncionamento(funcionamento);
  const { hora, minuto } = horaEmBrasilia(agora);
  const abreHoje = hora * 60 + minuto < f.abreAs * 60;

  return `A Camily atende das ${porExtenso(f.abreAs)} às ${porExtenso(
    f.fechaAs
  )}. Você pode montar seu carrinho agora e finalizar ${
    abreHoje ? `a partir das ${porExtenso(f.abreAs)}` : `amanhã, a partir das ${porExtenso(f.abreAs)}`
  }.`;
}
