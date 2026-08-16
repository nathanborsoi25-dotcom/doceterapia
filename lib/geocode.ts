/**
 * Endereço → latitude/longitude, que é o que o cálculo de frete precisa
 * (fórmula de Haversine em `lib/shipping.ts`).
 *
 * São três camadas, nesta ordem, e a ordem é o que segura o custo:
 *
 * 1. **Cache no banco** — endereço não muda de lugar. A mesma cliente
 *    comprando de novo, ou a vizinha da mesma rua, não gera consulta nenhuma.
 * 2. **Nominatim (OpenStreetMap)** — gratuito e sem chave. Resolve boa parte,
 *    e é a única camada que existia até 16/08/2026.
 * 3. **Google, depois TomTom** — só quando o OSM falha, e só se houver chave
 *    configurada. Os dois têm base de mapas própria, que é o que resolve o
 *    problema; o TomTom está aqui porque a cota gratuita dele não exige
 *    cartão cadastrado, e a conta do Google trava em `OR_BACR2_44` para muita
 *    gente no Brasil.
 *
 * ⚠️ **Por que um serviço pago entrou:** algumas ruas de Arapongas não estão
 * no OpenStreetMap. Medido em 16/08/2026 com `scripts/_medir-cobertura-mapa`:
 * **7 de 8 endereços reais localizados**. A "Rua Juriti Piranga" (CEP
 * 86703-480) é a que faltou — os Correios conhecem, o mapa não, e a cliente
 * não conseguia calcular a entrega.
 *
 * Trocar por Mapbox ou LocationIQ não resolveria: os dois são construídos
 * sobre o OSM e teriam o mesmo buraco. Google e TomTom têm base própria.
 *
 * ⚠️ **Sem `GOOGLE_MAPS_API_KEY` tudo funciona como antes**, só com o OSM.
 * A chave é opcional de propósito: nada aqui pode quebrar por falta dela.
 *
 * Uso do lado do SERVIDOR apenas (as rotas /api chamam isto), pra podermos
 * enviar o User-Agent que a política do Nominatim exige e pra a chave do
 * Google nunca chegar ao navegador.
 */
import { unstable_noStore as naoGuardar } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { geocache } from "./db/schema";
import { checarAreaEntrega } from "./area-entrega";

export type Coords = { lat: number; lng: number };

const USER_AGENT = "Doceterapia/1.0 (https://doceterapia.net.br)";

/**
 * Quanto tempo uma FALHA vale antes de valer a pena perguntar de novo.
 *
 * Guardar a falha evita repetir duas consultas a cada tentativa de um
 * endereço que ninguém acha. Mas mapa é coisa viva: a rua que falta hoje pode
 * ser cadastrada semana que vem, e uma falha eterna deixaria essa cliente sem
 * entrega para sempre.
 */
const DIAS_ATE_TENTAR_DE_NOVO = 7;

export type EnderecoInput = {
  rua?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  cep?: string;
  uf?: string;
};

/**
 * O mesmo endereço escrito de jeitos diferentes tem que cair na mesma linha do
 * cache: "Rua Ajaja" e "rua ajaja " são o mesmo lugar.
 */
export function chaveDoEndereco(e: EnderecoInput): string {
  const limpo = (t?: string) =>
    (t ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  return [
    limpo(e.rua),
    limpo(e.numero),
    limpo(e.bairro),
    limpo(e.cidade) || "arapongas",
    (e.cep ?? "").replace(/\D/g, ""),
  ].join("|");
}

async function lerDoCache(
  chave: string
): Promise<{ coords: Coords | null; conhecido: boolean }> {
  /*
   * ⚠️ O Next embrulha o `fetch` global com cache próprio, e o driver do Neon
   * conversa com o banco por `fetch` — sem isto a leitura do cache poderia
   * congelar e devolver "não achou" para sempre, mesmo depois de o endereço
   * ter sido resolvido. Mesma armadilha que travou a rota do frete em 13/08.
   */
  naoGuardar();

  try {
    const [linha] = await getDb().select().from(geocache).where(eq(geocache.chave, chave));
    if (!linha) return { coords: null, conhecido: false };

    if (linha.achou && linha.lat != null && linha.lng != null) {
      return { coords: { lat: linha.lat, lng: linha.lng }, conhecido: true };
    }

    // Falha guardada: só vale enquanto for recente.
    const dias = (Date.now() - new Date(linha.criadoEm).getTime()) / 86_400_000;
    return { coords: null, conhecido: dias < DIAS_ATE_TENTAR_DE_NOVO };
  } catch {
    // Banco fora do ar não pode derrubar o cálculo do frete: segue sem cache.
    return { coords: null, conhecido: false };
  }
}

async function guardarNoCache(
  chave: string,
  coords: Coords | null,
  fonte: string
): Promise<void> {
  try {
    await getDb()
      .insert(geocache)
      .values({
        chave,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        achou: coords != null,
        fonte,
        criadoEm: new Date(),
      })
      // Uma tentativa nova sempre substitui a anterior: é assim que a falha
      // vencida some e vira acerto quando o mapa é atualizado.
      .onConflictDoUpdate({
        target: geocache.chave,
        set: {
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          achou: coords != null,
          fonte,
          criadoEm: new Date(),
        },
      });
  } catch {
    // Não conseguiu guardar: o endereço foi resolvido do mesmo jeito.
  }
}

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
    // rede indisponível → devolve null e a próxima camada tenta
  }
  return null;
}

/**
 * Google Geocoding. Só roda quando o OSM falhou e a chave existe.
 *
 * ⚠️ **Resultado impreciso é recusado.** O Google sempre responde alguma
 * coisa: quando não acha a rua, devolve o centro do bairro ou da cidade com
 * `location_type: APPROXIMATE`. Aceitar isso seria pior do que não achar —
 * cobraria frete de um ponto onde a cliente não mora, e o prejuízo (ou a
 * cobrança a mais) apareceria calado. Foi exatamente por isso que a BrasilAPI
 * foi descartada: ela devolve o centro de Arapongas para qualquer CEP.
 */
async function google(e: EnderecoInput): Promise<Coords | null> {
  const chave = process.env.GOOGLE_MAPS_API_KEY;
  if (!chave) return null;

  /*
   * ⚠️ Só endereço de Arapongas chega ao serviço pago.
   *
   * `/api/geocodificar` é pública e sem limite de uso — hoje isso não custa
   * nada porque o OpenStreetMap é grátis, mas com o Google cada chamada tem
   * preço, e uma rota aberta vira conta a pagar se alguém resolver disparar
   * consultas. A loja só entrega em Arapongas: endereço de fora não teria
   * frete de qualquer jeito, então não há por que perguntar ao Google.
   *
   * Isso é a trava do lado de cá. A outra é o teto de cota, definido no
   * painel do Google — as duas juntas é que fecham a porta.
   */
  if (!checarAreaEntrega({ cep: e.cep, cidade: e.cidade }).atendido) return null;

  const endereco = [
    e.rua && e.numero ? `${e.rua}, ${e.numero}` : e.rua,
    e.bairro,
    e.cidade || "Arapongas",
    e.uf || "PR",
  ]
    .filter(Boolean)
    .join(", ");
  if (!endereco.trim()) return null;

  const cep = (e.cep ?? "").replace(/\D/g, "");
  const componentes = ["country:BR", cep ? `postal_code:${cep}` : ""]
    .filter(Boolean)
    .join("|");

  const qs = new URLSearchParams({
    address: endereco,
    components: componentes,
    language: "pt-BR",
    region: "br",
    key: chave,
  });

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${qs.toString()}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;

    const data = (await res.json()) as {
      status: string;
      results?: Array<{
        geometry?: { location?: { lat: number; lng: number }; location_type?: string };
      }>;
    };

    if (data.status !== "OK" || !data.results?.length) return null;

    const primeiro = data.results[0];
    const tipo = primeiro.geometry?.location_type;
    // APPROXIMATE = "achei a região, não o endereço". Não serve para frete.
    if (tipo === "APPROXIMATE") return null;

    const loc = primeiro.geometry?.location;
    if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) {
      return { lat: loc.lat, lng: loc.lng };
    }
  } catch {
    // Serviço fora do ar ou cota estourada: o site segue sem coordenada, que
    // é o mesmo desfecho de antes de ele existir.
  }
  return null;
}

/**
 * TomTom — a alternativa ao Google, com base de mapas própria (não é
 * OpenStreetMap, então não tem o mesmo buraco nas ruas de Arapongas).
 *
 * Existe porque a conta do Google trava em `OR_BACR2_44` para muita gente no
 * Brasil, e porque a cota gratuita do TomTom não exige cartão cadastrado.
 * Vale a mesma regra do Google: só entra quando o OSM falhou, só para
 * endereço de Arapongas, e resultado impreciso é recusado.
 */
async function tomtom(e: EnderecoInput): Promise<Coords | null> {
  const chave = process.env.TOMTOM_API_KEY;
  if (!chave) return null;
  if (!checarAreaEntrega({ cep: e.cep, cidade: e.cidade }).atendido) return null;

  const endereco = [
    e.rua && e.numero ? `${e.rua}, ${e.numero}` : e.rua,
    e.bairro,
    e.cidade || "Arapongas",
    e.uf || "PR",
    "Brasil",
  ]
    .filter(Boolean)
    .join(", ");
  if (!endereco.trim()) return null;

  const qs = new URLSearchParams({
    key: chave,
    countrySet: "BR",
    limit: "1",
    language: "pt-BR",
  });

  try {
    const res = await fetch(
      `https://api.tomtom.com/search/2/geocode/${encodeURIComponent(endereco)}.json?${qs}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;

    const data = (await res.json()) as {
      results?: Array<{
        type?: string;
        position?: { lat: number; lon: number };
      }>;
    };

    const primeiro = data.results?.[0];
    if (!primeiro?.position) return null;

    /*
     * ⚠️ Mesma recusa do Google, com o nome que o TomTom usa: `type` diz o que
     * ele achou de verdade. "Geography" é município ou bairro inteiro — a
     * coordenada do meio de uma região, que mediria o frete do lugar errado.
     * Serve só quando ele acertou o ponto ou pelo menos a rua.
     */
    const tipo = primeiro.type;
    if (tipo !== "Point Address" && tipo !== "Address Range" && tipo !== "Street") {
      return null;
    }

    const { lat, lon } = primeiro.position;
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lng: lon };
  } catch {
    // Fora do ar ou cota estourada: segue sem coordenada, como antes dele existir.
  }
  return null;
}

/** Só o OpenStreetMap, com as tentativas que ele aceita. */
async function peloOsm(e: EnderecoInput): Promise<Coords | null> {
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

  /*
   * ⚠️ Só vale procurar assim se houver RUA na busca.
   *
   * Sem ela sobra "Arapongas, PR, Brasil", e o Nominatim responde com o centro
   * da cidade — uma coordenada que parece boa, entra no cálculo e cobra o
   * frete do lugar errado. É a mesma armadilha que reprovou a BrasilAPI.
   */
  if (e.rua && partes.length) {
    const r = await nominatim({ q: partes.join(", ") });
    if (r) return r;
  }

  return null;
}

/** Geocodifica um endereço estruturado. Cache → OpenStreetMap → Google. */
export async function geocodificar(e: EnderecoInput): Promise<Coords | null> {
  const chave = chaveDoEndereco(e);

  const doCache = await lerDoCache(chave);
  if (doCache.coords) return doCache.coords;
  // Falha recente já guardada: não vale gastar consulta de novo agora.
  if (doCache.conhecido) return null;

  const doOsm = await peloOsm(e);
  if (doOsm) {
    await guardarNoCache(chave, doOsm, "osm");
    return doOsm;
  }

  /*
   * Os serviços pagos, em ordem de cobertura. Cada um só roda se tiver chave,
   * então a loja pode ter os dois, um só, ou nenhum — neste último caso o
   * comportamento é o de sempre, só com o OpenStreetMap.
   */
  const doGoogle = await google(e);
  if (doGoogle) {
    await guardarNoCache(chave, doGoogle, "google");
    return doGoogle;
  }

  const doTomTom = await tomtom(e);
  await guardarNoCache(chave, doTomTom, doTomTom ? "tomtom" : "nenhum");
  return doTomTom;
}

/**
 * Geocodifica um endereço em texto livre — hoje só o endereço de ONDE A
 * ENTREGA SAI, que a Camily digita em `/admin/frete`.
 *
 * Este é o endereço mais crítico do site inteiro: é dele que sai a medida de
 * todos os fretes. Se ele não for localizado, o `PUT /api/frete` mantém as
 * coordenadas antigas — mas um endereço novo entraria sem coordenada nenhuma
 * e a loja pararia de calcular entrega para todo mundo de uma vez. Por isso
 * ele também tenta o Google quando o OpenStreetMap não sabe.
 *
 * Sem cache de propósito: acontece uma vez a cada mudança de endereço, e é
 * melhor perguntar de novo do que servir uma coordenada velha para a origem.
 */
export async function geocodificarTexto(endereco: string): Promise<Coords | null> {
  if (!endereco.trim()) return null;

  const doOsm = await nominatim({ q: `${endereco}, Brasil` });
  if (doOsm) return doOsm;

  const chave = process.env.GOOGLE_MAPS_API_KEY;
  if (!chave) return null;

  const qs = new URLSearchParams({
    address: `${endereco}, Brasil`,
    components: "country:BR",
    language: "pt-BR",
    region: "br",
    key: chave,
  });

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${qs.toString()}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;

    const data = (await res.json()) as {
      status: string;
      results?: Array<{
        geometry?: { location?: { lat: number; lng: number }; location_type?: string };
      }>;
    };
    if (data.status !== "OK" || !data.results?.length) return null;

    const primeiro = data.results[0];
    // Mesma recusa da outra função: "achei a região" não serve para medir frete.
    if (primeiro.geometry?.location_type === "APPROXIMATE") return null;

    const loc = primeiro.geometry?.location;
    if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) {
      return { lat: loc.lat, lng: loc.lng };
    }
  } catch {
    // Fora do ar: quem chama mantém as coordenadas que já tinha.
  }
  return null;
}
