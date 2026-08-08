/**
 * Onde a cliente pode buscar o pedido.
 *
 * São os endereços da própria Camily, com horários diferentes, e é a cliente
 * quem escolhe qual fica melhor pra ela. O dia e a hora exatos ela combina
 * pelo WhatsApp — o site não agenda mais nada, porque marcar horário sem a
 * Camily confirmar só criava desencontro.
 *
 * A lista fica no banco (`config_loja.pontos_retirada`) e ela edita em
 * `/admin/retirada`. O padrão abaixo é o que vale enquanto ela não mexer.
 */
export type PontoRetirada = {
  id: string;
  endereco: string;
  /** Uma linha por faixa de horário, na ordem em que a cliente lê. */
  horarios: string[];
};

export const PONTOS_PADRAO: PontoRetirada[] = [
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

/**
 * Os pontos que valem agora. Lista vazia cai no padrão de propósito: a
 * retirada é a única saída de quem mora fora de Arapongas, então ela não pode
 * ficar sem nenhuma opção por causa de um campo apagado sem querer.
 */
export function pontosDaLoja(
  salvos: PontoRetirada[] | null | undefined
): PontoRetirada[] {
  const limpos = (salvos ?? []).filter((p) => p?.id && p?.endereco?.trim());
  return limpos.length > 0 ? limpos : PONTOS_PADRAO;
}

export function pontoRetiradaPorId(
  pontos: PontoRetirada[],
  id: string | null | undefined
) {
  return pontos.find((p) => p.id === id);
}

/**
 * O ponto em uma linha só, do jeito que fica gravado no pedido e aparece no
 * painel e no e-mail. Guardamos o TEXTO (e não só o id) porque o pedido é um
 * registro do que foi combinado: a Camily mudar o horário amanhã não pode
 * reescrever o que a cliente leu quando comprou.
 */
export function descricaoDoPonto(ponto: PontoRetirada): string {
  const horarios = ponto.horarios.filter((h) => h.trim());
  return horarios.length > 0
    ? `${ponto.endereco} — ${horarios.join(" · ")}`
    : ponto.endereco;
}

/**
 * Peneira o que vem do painel antes de gravar: só endereço e horários, em
 * texto puro e com tamanho limitado. Sem isso, o jsonb viraria porta pra
 * guardar qualquer coisa.
 */
export function limparPontos(valor: unknown): PontoRetirada[] {
  if (!Array.isArray(valor)) return [];
  const texto = (v: unknown, limite: number) =>
    typeof v === "string" ? v.trim().slice(0, limite) : "";

  return valor
    .slice(0, 10)
    .map((p, i) => {
      const bruto = p as Partial<PontoRetirada>;
      return {
        id: texto(bruto.id, 40) || `ponto-${i + 1}`,
        endereco: texto(bruto.endereco, 160),
        horarios: (Array.isArray(bruto.horarios) ? bruto.horarios : [])
          .slice(0, 6)
          .map((h) => texto(h, 120))
          .filter(Boolean),
      };
    })
    .filter((p) => p.endereco);
}
