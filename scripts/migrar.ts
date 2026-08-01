import { neon } from "@neondatabase/serverless";

/**
 * Migração ADITIVA: só acrescenta colunas e tabela novas.
 * Nenhum DROP, nenhum ALTER destrutivo — rodar duas vezes não faz mal.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/migrar.ts
 */
async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  console.log("1) Colunas novas em pedidos (pagamento e cancelamento)...");
  await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS pagamento_id text`;
  await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cancelado_por text`;
  await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS motivo_cancelamento text`;
  await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cancelado_em timestamptz`;
  await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS status_reembolso text`;
  await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS valor_reembolsado double precision`;

  console.log("2) Tabela de avaliações...");
  await sql`
    CREATE TABLE IF NOT EXISTS avaliacoes (
      id text PRIMARY KEY,
      produto_id text NOT NULL,
      cliente_id text NOT NULL,
      pedido_id text NOT NULL,
      nota integer NOT NULL,
      comentario text NOT NULL DEFAULT '',
      visivel boolean NOT NULL DEFAULT true,
      criado_em timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS avaliacoes_pedido_produto_idx
    ON avaliacoes (pedido_id, produto_id)
  `;

  console.log("\nConferindo o resultado:");
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'pedidos'
      AND column_name IN ('pagamento_id','cancelado_por','motivo_cancelamento',
                          'cancelado_em','status_reembolso','valor_reembolsado')
    ORDER BY column_name
  `;
  console.log("  pedidos:", cols.map((c) => c.column_name).join(", "));

  const tab = await sql`SELECT to_regclass('public.avaliacoes') AS t`;
  console.log("  tabela avaliacoes:", tab[0].t ?? "NÃO CRIADA");
  console.log("\nPronto.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
