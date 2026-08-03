import { neon } from "@neondatabase/serverless";

/**
 * Migração ADITIVA: só acrescenta colunas e tabelas novas.
 * Nenhum DROP, nenhum ALTER destrutivo — rodar duas vezes não faz mal.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/migrar.ts
 */
async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  console.log("1) Colunas de pagamento e cancelamento em pedidos...");
  await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS pagamento_id text`;
  await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cancelado_por text`;
  await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS motivo_cancelamento text`;
  await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cancelado_em timestamptz`;
  await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS status_reembolso text`;
  await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS valor_reembolsado double precision`;

  console.log("1b) Presente e bilhete no pedido...");
  await sql`
    ALTER TABLE pedidos
    ADD COLUMN IF NOT EXISTS eh_presente boolean NOT NULL DEFAULT false
  `;
  await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS nome_quem_recebe text`;
  await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS bilhete text`;

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

  console.log("3) Estoque dos doces (nulo = não controla)...");
  await sql`ALTER TABLE produtos ADD COLUMN IF NOT EXISTS estoque integer`;

  console.log("3b) Galeria de até 3 fotos por doce...");
  await sql`
    ALTER TABLE produtos
    ADD COLUMN IF NOT EXISTS fotos jsonb NOT NULL DEFAULT '[]'::jsonb
  `;
  // Quem já tinha foto entra na galeria com ela na primeira posição.
  await sql`
    UPDATE produtos
    SET fotos = jsonb_build_array(foto_url)
    WHERE fotos = '[]'::jsonb AND coalesce(foto_url, '') <> ''
  `;

  console.log("3d) Categoria e data de criação do doce...");
  await sql`ALTER TABLE produtos ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT ''`;
  await sql`
    ALTER TABLE produtos
    ADD COLUMN IF NOT EXISTS criado_em timestamptz NOT NULL DEFAULT now()
  `;

  console.log("3e) Tabela de categorias...");
  await sql`
    CREATE TABLE IF NOT EXISTS categorias (
      id text PRIMARY KEY,
      nome text NOT NULL UNIQUE,
      ordem integer NOT NULL DEFAULT 0,
      criado_em timestamptz NOT NULL DEFAULT now()
    )
  `;
  // Categorias que já estavam digitadas nos doces viram registros, pra nada
  // se perder na virada.
  await sql`
    INSERT INTO categorias (id, nome, ordem)
    SELECT gen_random_uuid()::text, categoria, row_number() OVER (ORDER BY categoria) - 1
    FROM (SELECT DISTINCT trim(categoria) AS categoria FROM produtos WHERE trim(categoria) <> '') AS existentes
    ON CONFLICT (nome) DO NOTHING
  `;

  console.log("3c) Sabores (recheios) do mesmo doce...");
  await sql`
    CREATE TABLE IF NOT EXISTS sabores (
      id text PRIMARY KEY,
      produto_id text NOT NULL,
      nome text NOT NULL,
      foto_url text NOT NULL DEFAULT '',
      preco double precision,
      estoque integer,
      ordem integer NOT NULL DEFAULT 0,
      ativo boolean NOT NULL DEFAULT true
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS sabores_produto_idx ON sabores (produto_id)`;
  await sql`
    ALTER TABLE sabores
    ADD COLUMN IF NOT EXISTS custo double precision NOT NULL DEFAULT 0
  `;
  await sql`ALTER TABLE sabores ADD COLUMN IF NOT EXISTS disponibilidade text`;
  await sql`ALTER TABLE sabores ADD COLUMN IF NOT EXISTS prazo_dias integer`;

  console.log("4) Stories das clientes + pontos por story...");
  await sql`
    CREATE TABLE IF NOT EXISTS stories (
      id text PRIMARY KEY,
      cliente_id text NOT NULL,
      pedido_id text NOT NULL,
      imagem_url text NOT NULL,
      arroba text NOT NULL DEFAULT '',
      situacao text NOT NULL DEFAULT 'pendente',
      pontos_creditados integer NOT NULL DEFAULT 0,
      motivo_recusa text,
      criado_em timestamptz NOT NULL DEFAULT now(),
      decidido_em timestamptz
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS stories_pedido_idx ON stories (pedido_id)
  `;
  await sql`
    ALTER TABLE config_loja
    ADD COLUMN IF NOT EXISTS pontos_por_story integer NOT NULL DEFAULT 15
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

  const estoque = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'produtos' AND column_name = 'estoque'
  `;
  console.log("  produtos.estoque:", estoque.length ? "ok" : "NÃO CRIADA");

  const story = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'config_loja' AND column_name = 'pontos_por_story'
  `;
  console.log("  config_loja.pontos_por_story:", story.length ? "ok" : "NÃO CRIADA");

  for (const t of ["avaliacoes", "stories"]) {
    const existe = await sql`SELECT to_regclass(${"public." + t}) AS t`;
    console.log(`  tabela ${t}:`, existe[0].t ?? "NÃO CRIADA");
  }
  console.log("\nPronto.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
