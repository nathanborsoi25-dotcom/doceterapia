import type { ConfiguracaoFrete, FaixaFrete } from "./types";

/**
 * Configuração inicial de frete, baseada no exemplo que a Camily passou:
 * - 0 a 500m: grátis
 * - 501m a 3km: R$ 3,00
 * - 3,01km a 10km: R$ 10,00
 *
 * IMPORTANTE: lat/lng da origem abaixo são um placeholder aproximado do
 * centro de Arapongas-PR. Antes de ir pra produção, geocodifique o
 * endereço real "Rua Ajaja, 41 - Arapongas, PR" (ex: via Google Geocoding
 * API ou Nominatim/OpenStreetMap) e atualize os valores aqui, ou faça isso
 * direto pelo painel admin > Configurar frete, que grava lat/lng ao
 * salvar o endereço de origem.
 */
export const configuracaoFretePadrao: ConfiguracaoFrete = {
  origem: {
    endereco: "Rua Ajaja, 41 - Arapongas, PR",
    lat: -23.4114,
    lng: -51.4247,
  },
  faixas: [
    { id: "f1", distanciaMinKm: 0, distanciaMaxKm: 0.5, valor: 0 },
    { id: "f2", distanciaMinKm: 0.5, distanciaMaxKm: 3, valor: 3 },
    { id: "f3", distanciaMinKm: 3, distanciaMaxKm: 10, valor: 10 },
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
