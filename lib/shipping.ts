import { FUSO } from "./funcionamento";
import type { ConfiguracaoFrete, FaixaFrete, OrigemFrete } from "./types";

/**
 * Configuração de frete calibrada com recibos reais do Uber Envios em
 * Arapongas (mai/jun 2026):
 *   - 1,2 km  → R$ 7,22
 *   - 4,3 km  → R$ 9,45
 * Cruzando os dois pontos, o custo se comporta como uma taxa fixa de
 * ~R$ 6,50 mais ~R$ 0,60 por km (em linha reta). Ou seja: QUALQUER entrega
 * custa uns R$ 7, mesmo a duas quadras — por isso as faixas começam em
 * R$ 8,00 em vez dos R$ 3,00 do protótipo, que davam prejuízo.
 *
 * A faixa de até 500 m fica grátis por escolha da Camily (cortesia para
 * quem é bem pertinho; o custo do envio sai do bolso dela nesses casos).
 *
 * O Uber tem preço dinâmico (pico, chuva), então os valores abaixo são uma
 * média com arredondamento pra cima. Tudo é ajustável no painel admin >
 * Configurar frete, sem mexer no código.
 *
 * lat/lng da origem = geocodificação real da Rua Ajaja, 41.
 */
export const configuracaoFretePadrao: ConfiguracaoFrete = {
  origem: {
    endereco: "Rua Ajaja, 41 - Arapongas, PR",
    lat: -23.4164997,
    lng: -51.4328836,
  },
  /*
   * No fim de semana a Camily produz e entrega do outro endereço, então a
   * conta parte de lá. Sai vazio de propósito: quem liga é ela, no painel,
   * preenchendo o endereço — assim ninguém herda um ponto de partida que não
   * confirmou.
   */
  origemFimDeSemana: null,
  /** Zero = sem frete grátis. Quem liga é a Camily, em Configurar frete. */
  freteGratisAcimaDe: 0,
  faixas: [
    { id: "f1", distanciaMinKm: 0, distanciaMaxKm: 0.5, valor: 0 },
    { id: "f2", distanciaMinKm: 0.5, distanciaMaxKm: 2, valor: 8 },
    { id: "f3", distanciaMinKm: 2, distanciaMaxKm: 3, valor: 9 },
    { id: "f4", distanciaMinKm: 3, distanciaMaxKm: 5, valor: 10 },
    { id: "f5", distanciaMinKm: 5, distanciaMaxKm: 7, valor: 12 },
    { id: "f6", distanciaMinKm: 7, distanciaMaxKm: 10, valor: 14 },
    // As faixas abaixo cobrem o resto do município (bairros periféricos,
    // distritos e zona rural). O município de Arapongas se estende até
    // ~22 km da loja, então sem elas um morador da cidade era barrado.
    // São extrapolações da mesma fórmula, com margem maior porque a rota
    // real fica bem acima da linha reta nesses trechos.
    { id: "f7", distanciaMinKm: 10, distanciaMaxKm: 13, valor: 17 },
    { id: "f8", distanciaMinKm: 13, distanciaMaxKm: 16, valor: 20 },
    { id: "f9", distanciaMinKm: 16, distanciaMaxKm: 20, valor: 24 },
    { id: "f10", distanciaMinKm: 20, distanciaMaxKm: 25, valor: 28 },
  ],
};

/** Distância em km entre dois pontos (fórmula de Haversine). */
export function distanciaKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // raio da Terra em km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Calcula o valor do frete a partir da distância até o cliente.
 * Retorna null se a distância estiver fora de todas as faixas configuradas
 * (ex: fora da área de entrega) — nesse caso a UI deve avisar que só
 * entregamos em Arapongas por enquanto.
 */
export function calcularFrete(
  distancia: number,
  faixas: FaixaFrete[]
): number | null {
  const faixa = faixas.find(
    (f) => distancia > f.distanciaMinKm && distancia <= f.distanciaMaxKm
  );
  // distância 0 exata cai na primeira faixa (grátis)
  if (distancia === 0 && faixas[0]) return faixas[0].valor;
  return faixa ? faixa.valor : null;
}

/** Dia da semana no calendário de Brasília: 0 = domingo … 6 = sábado. */
export function diaDaSemanaEmBrasilia(agora = new Date()): number {
  const sigla = new Intl.DateTimeFormat("en-US", {
    timeZone: FUSO,
    weekday: "short",
  }).format(agora);
  const dias = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const i = dias.indexOf(sigla);
  return i === -1 ? new Date(agora).getDay() : i;
}

/**
 * É sábado ou domingo?
 *
 * ⚠️ Sempre pelo relógio de Brasília. A Vercel roda em UTC, e às 21h de
 * sábado lá já é domingo — o pedido sairia do endereço errado nas três horas
 * mais movimentadas da noite de sábado. É o mesmo tropeço que já derrubou o
 * prazo dos pedidos (`lib/prazo.ts`) e o horário da loja
 * (`lib/funcionamento.ts`).
 */
export function ehFimDeSemana(agora = new Date()): boolean {
  const dia = diaDaSemanaEmBrasilia(agora);
  return dia === 0 || dia === 6;
}

/** Uma origem só serve se tiver coordenadas de verdade. */
function origemUtilizavel(o: OrigemFrete | null | undefined): o is OrigemFrete {
  return (
    !!o &&
    Number.isFinite(o.lat) &&
    Number.isFinite(o.lng) &&
    !(o.lat === 0 && o.lng === 0)
  );
}

/**
 * De onde a entrega sai hoje.
 *
 * Segunda a sexta é o endereço de sempre; sábado e domingo, o do fim de
 * semana — quando a Camily preencheu um. Endereço de fim de semana sem
 * coordenadas (a geocodificação não achou) cai no de sempre: cobrar o frete
 * de segunda é melhor do que medir a distância a partir do meio do nada.
 */
export function origemDoDia(
  config: ConfiguracaoFrete,
  agora = new Date()
): OrigemFrete {
  const fimDeSemana = config.origemFimDeSemana;
  if (ehFimDeSemana(agora) && origemUtilizavel(fimDeSemana)) return fimDeSemana;
  return config.origem;
}

/** O mínimo que dá frete grátis, já limpo. Zero = desligado. */
export function minimoFreteGratis(
  config: Pick<ConfiguracaoFrete, "freteGratisAcimaDe">
): number {
  const n = Number(config.freteGratisAcimaDe);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Quanto ainda falta em doces pra entrega sair de graça. Zero quando já deu
 * (ou quando a Camily não ligou a regra).
 *
 * Bater o valor exato JÁ ganha: "frete grátis acima de R$ 50" com R$ 50,00 na
 * tela e frete cobrado do mesmo jeito é a reclamação certa.
 */
export function faltaParaFreteGratis(valorEmDoces: number, minimo: number): number {
  if (minimo <= 0) return 0;
  return Math.max(0, minimo - valorEmDoces);
}

export type CalculoFrete = {
  distanciaKm: number;
  /** `null` = endereço fora de todas as faixas, ou seja, fora da área. */
  valor: number | null;
  /** Zerou porque o pedido bateu o mínimo — a tela comemora isso. */
  gratisPorValor: boolean;
  /** De onde a conta partiu hoje (muda no fim de semana). */
  origem: OrigemFrete;
};

/**
 * O frete deste endereço, hoje.
 *
 * `valorEmDoces` é o que a cliente paga em doces (já sem o cupom): é ele que
 * decide o frete grátis. Usar o subtotal cheio daria entrega de graça por um
 * carrinho que o cupom derrubou pela metade.
 */
export function calcularFretePorEndereco(
  clienteLat: number,
  clienteLng: number,
  config: ConfiguracaoFrete,
  opcoes: { valorEmDoces?: number; agora?: Date } = {}
): CalculoFrete {
  const agora = opcoes.agora ?? new Date();
  const origem = origemDoDia(config, agora);
  const d = distanciaKm(origem.lat, origem.lng, clienteLat, clienteLng);
  const distancia = Math.round(d * 100) / 100;
  const valorDaFaixa = calcularFrete(d, config.faixas);

  // Fora de todas as faixas continua fora. Frete grátis é desconto, não
  // ampliação de área: quem mora a 40 km não passa a ser atendido por gastar
  // mais — a Camily continuaria sem ter como levar.
  if (valorDaFaixa === null) {
    return { distanciaKm: distancia, valor: null, gratisPorValor: false, origem };
  }

  const minimo = minimoFreteGratis(config);
  const bateuOMinimo = minimo > 0 && (opcoes.valorEmDoces ?? 0) >= minimo;

  return {
    distanciaKm: distancia,
    valor: bateuOMinimo ? 0 : valorDaFaixa,
    // A faixa de até 500 m já é grátis por cortesia; ali não há o que anunciar.
    gratisPorValor: bateuOMinimo && valorDaFaixa > 0,
    origem,
  };
}
