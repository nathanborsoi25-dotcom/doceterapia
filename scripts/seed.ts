import { getDb } from "../lib/db";
import { produtos, configFrete } from "../lib/db/schema";
import { configuracaoFretePadrao } from "../lib/shipping";
import type { Produto } from "../lib/types";

/**
 * Popula o banco com os dados iniciais (dois doces de exemplo e a
 * configuração de frete padrão). Idempotente: rodar de novo não duplica
 * nem sobrescreve nada (onConflictDoNothing).
 *
 * Rodar com:
 *   npx dotenv -e .env.local -- npx tsx scripts/seed.ts
 */
const produtosIniciais: Produto[] = [
  {
    id: "p1",
    nome: "Brigadeiro Gourmet",
    descricao: "Brigadeiro cremoso feito com chocolate belga, enrolado na hora.",
    sabor: "Chocolate",
    preco: 4.5,
    fotoUrl: "",
    disponibilidade: "pronta_entrega",
    ativo: true,
  },
  {
    id: "p2",
    nome: "Torta de Cereja",
    descricao:
      "Torta cremosa de baunilha com cobertura de cereja, feita por encomenda.",
    sabor: "Cereja",
    preco: 65,
    fotoUrl: "",
    disponibilidade: "sob_encomenda",
    prazoDias: 3,
    ativo: true,
  },
];

async function main() {
  const db = getDb();

  for (const p of produtosIniciais) {
    // Campos escolhidos um a um: o tipo Produto tem coisas que só existem na
    // tela (nota média, recheios, data em texto) e não entram no insert.
    await db
      .insert(produtos)
      .values({
        id: p.id,
        nome: p.nome,
        descricao: p.descricao,
        sabor: p.sabor,
        preco: p.preco,
        fotoUrl: p.fotoUrl,
        disponibilidade: p.disponibilidade,
        prazoDias: p.prazoDias ?? null,
        ativo: p.ativo,
      })
      .onConflictDoNothing();
  }

  await db
    .insert(configFrete)
    .values({
      id: "default",
      origem: configuracaoFretePadrao.origem,
      faixas: configuracaoFretePadrao.faixas,
    })
    .onConflictDoNothing();

  console.log("✓ Seed concluído: produtos iniciais + configuração de frete.");
}

main().catch((err) => {
  console.error("Erro no seed:", err);
  process.exit(1);
});
