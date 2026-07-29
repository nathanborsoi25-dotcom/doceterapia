import type { ConfiguracaoFrete, FaixaFrete } from "./types";

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

export function calcularFretePorEndereco(
  clienteLat: number,
  clienteLng: number,
  config: ConfiguracaoFrete
): { distanciaKm: number; valor: number | null } {
  const d = distanciaKm(
    config.origem.lat,
    config.origem.lng,
    clienteLat,
    clienteLng
  );
  return { distanciaKm: Math.round(d * 100) / 100, valor: calcularFrete(d, config.faixas) };
}
