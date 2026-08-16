import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { geocache } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/require-admin";
import { chaveDoEndereco, geocodificar, type EnderecoInput } from "@/lib/geocode";

export const dynamic = "force-dynamic";

/**
 * "O site está conseguindo achar os endereços no mapa?"
 *
 * Mesma ideia do diagnóstico de pagamento e do de e-mail, e pelo mesmo
 * motivo: as chaves dos serviços de mapa só existem na Vercel, então nem eu
 * nem nenhum teste local conseguem saber se elas funcionam **em produção**.
 * Esta rota roda lá dentro, com as chaves de verdade, e devolve quem
 * respondeu o quê — em português, sem precisar ler log (a conexão da Vercel
 * não tem permissão pra isso).
 *
 * ⚠️ As chaves NUNCA aparecem na resposta: só se existem ou não.
 *
 * Abrir logada no painel: /api/admin/diagnostico-mapa
 */

/** Endereços de verdade, escolhidos para separar os casos. */
const CASOS: Array<{ oQueTesta: string; endereco: EnderecoInput }> = [
  {
    oQueTesta: "Rua que o mapa gratuito conhece — tem que achar mesmo sem chave nenhuma",
    endereco: {
      rua: "Rua Anu Branco",
      numero: "100",
      bairro: "Jardim Portal das Flores",
      cidade: "Arapongas",
      cep: "86701-530",
      uf: "PR",
    },
  },
  {
    oQueTesta: "A rua da cliente que não conseguiu comprar — só acha com chave",
    endereco: {
      rua: "Rua Juriti Piranga",
      numero: "498",
      bairro: "Jardim San Rafael",
      cidade: "Arapongas",
      cep: "86703-480",
      uf: "PR",
    },
  },
  {
    oQueTesta: "De onde a entrega sai — se este falhar, nenhum frete é calculado",
    endereco: {
      rua: "Rua Ajaja",
      numero: "41",
      cidade: "Arapongas",
      cep: "86701-000",
      uf: "PR",
    },
  },
];

export async function GET() {
  const negado = await requireAdmin();
  if (negado) return negado;

  const temGoogle = Boolean(process.env.GOOGLE_MAPS_API_KEY);
  const temTomTom = Boolean(process.env.TOMTOM_API_KEY);

  const db = getDb();
  const resultados = [];

  for (const caso of CASOS) {
    const chave = chaveDoEndereco(caso.endereco);

    // Apaga o que estiver guardado: senão o teste responderia com o resultado
    // de antes da chave existir, e diria que nada mudou.
    await db.delete(geocache).where(eq(geocache.chave, chave));

    const inicio = Date.now();
    const coords = await geocodificar(caso.endereco);
    const ms = Date.now() - inicio;

    // Quem respondeu ficou gravado no cache pela própria busca.
    const [linha] = await db.select().from(geocache).where(eq(geocache.chave, chave));

    resultados.push({
      oQueTesta: caso.oQueTesta,
      endereco: [caso.endereco.rua, caso.endereco.numero].filter(Boolean).join(", "),
      achou: coords !== null,
      coordenadas: coords,
      quemRespondeu: linha?.fonte ?? "?",
      demorou: `${ms}ms`,
    });
  }

  const achouTudo = resultados.every((r) => r.achou);
  const aRuaDoPrint = resultados[1];

  return NextResponse.json({
    leitura: !temGoogle && !temTomTom
      ? "NENHUMA CHAVE CONFIGURADA: o site está usando só o mapa gratuito, como sempre. Endereço que ele não conhece continua sem frete."
      : achouTudo
        ? `TUDO CERTO: os três endereços foram localizados, e a rua que não funcionava veio do ${aRuaDoPrint.quemRespondeu}. A chave está valendo.`
        : aRuaDoPrint.achou
          ? "A rua que não funcionava agora acha, mas outro endereço falhou — veja a lista abaixo."
          : "A CHAVE NÃO ESTÁ RESOLVENDO: a rua da cliente continua sem ser localizada. Confira se a chave foi salva no ambiente Production e se saiu um deploy novo depois disso.",
    chaves: {
      google: temGoogle ? "configurada" : "ausente",
      tomtom: temTomTom ? "configurada" : "ausente",
    },
    resultados,
  });
}
