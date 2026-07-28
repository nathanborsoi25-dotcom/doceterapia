/**
 * Geocodificação de endereços via Nominatim (OpenStreetMap) — gratuito, sem
 * chave de API. Converte um endereço em latitude/longitude, que é o que o
 * cálculo de frete (fórmula de Haversine em lib/shipping.ts) precisa.
 *
 * Uso do lado do SERVIDOR apenas (as rotas /api chamam isto), pra podermos
 * enviar o cabeçalho User-Agent que a política do Nominatim exige.
 */

export type Coords = { lat: number; lng: number };

const USER_AGENT = "Doceterapia/1.0 (https://doceterapia.vercel.app)";

async function nominatim(params: Record<string, string>): Promise<Coords | null> {
  const qs = new URLSearchParams({
    format: "jsonv2",
    limit: "1",
    countrycodes: "br",
    ...params,
  });

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${qs.toString()}`,
      { headers: { "User-Agent": USER_AGENT }, cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (Array.isArray(data) && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
  } catch {
    // rede indisponível → devolve null e o frete cai no fallback
  }
  return null;
}

export type EnderecoInput = {
  rua?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  cep?: string;
  uf?: string;
};

/** Geocodifica um endereço estruturado, com algumas tentativas de fallback. */
export async function geocodificar(e: EnderecoInput): Promise<Coords | null> {
  const cep = (e.cep ?? "").replace(/\D/g, "");
  const cidade = e.cidade || "Arapongas";
  const uf = e.uf || "PR";

  // 1) Consulta estruturada (rua + número, cidade, CEP).
  const street = `${e.numero ?? ""} ${e.rua ?? ""}`.trim();
  if (street) {
    const r = await nominatim({
      street,
      city: cidade,
      state: uf,
      postalcode: cep,
      country: "Brasil",
    });
    if (r) return r;
  }

  // 2) Consulta livre com bairro/cidade.
  const partes = [
    e.rua && e.numero ? `${e.rua}, ${e.numero}` : e.rua,
    e.bairro,
    cidade,
    uf,
    "Brasil",
  ].filter(Boolean) as string[];
  if (partes.length) {
    const r = await nominatim({ q: partes.join(", ") });
    if (r) return r;
  }

  // 3) Só o CEP.
  if (cep) {
    const r = await nominatim({ postalcode: cep, country: "Brasil" });
    if (r) return r;
  }

  return null;
}

/** Geocodifica um endereço em texto livre (ex: endereço de origem da loja). */
export async function geocodificarTexto(endereco: string): Promise<Coords | null> {
  if (!endereco.trim()) return null;
  return nominatim({ q: `${endereco}, Brasil` });
}
