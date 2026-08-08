/**
 * Onde a cliente pode buscar o pedido.
 *
 * São dois lugares com horários diferentes, e é a cliente quem escolhe qual
 * fica melhor pra ela. O dia e a hora exatos ela combina com a Camily pelo
 * WhatsApp — o site não agenda mais nada, porque marcar horário no site sem a
 * Camily confirmar só criava desencontro.
 *
 * Fica em código (e não no banco) porque são os endereços da própria Camily e
 * quase nunca mudam. Se um dia virarem coisa de mexer toda semana, o caminho é
 * o mesmo do "Sobre mim": uma tela no painel.
 */
export type PontoRetirada = {
  id: string;
  endereco: string;
  /** Uma linha por faixa de horário, na ordem em que a cliente lê. */
  horarios: string[];
};

export const PONTOS_RETIRADA: PontoRetirada[] = [
  {
    id: "ajaja",
    endereco: "Rua Ajaja, 41",
    horarios: ["Segunda a sexta, das 9h às 16h30"],
  },
  {
    id: "ariramba",
    endereco: "Rua Ariramba Pardo, 597",
    horarios: [
      "Segunda a sexta, das 18h30 às 22h",
      "Sábado e domingo, das 9h às 22h",
    ],
  },
];

export function pontoRetiradaPorId(id: string | null | undefined) {
  return PONTOS_RETIRADA.find((p) => p.id === id);
}

/**
 * O ponto em uma linha só, do jeito que fica gravado no pedido e aparece no
 * painel e no e-mail. Guardamos o TEXTO (e não só o id) porque o pedido é um
 * registro do que foi combinado: mudar o horário amanhã não pode reescrever o
 * que a cliente leu quando comprou.
 */
export function descricaoDoPonto(ponto: PontoRetirada): string {
  return `${ponto.endereco} — ${ponto.horarios.join(" · ")}`;
}
