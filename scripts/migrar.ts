import { neon } from "@neondatabase/serverless";

/**
 * Migração ADITIVA: acrescenta colunas, tabelas e índices. Nunca apaga dado
 * nem coluna — o mais longe que vai é AFROUXAR regra (tirar um NOT NULL, tirar
 * um "único"). Rodar duas vezes não faz mal.
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

  console.log("3b-3) Pausa de pronta entrega (o botão \"vou sair\")...");
  await sql`ALTER TABLE config_loja ADD COLUMN IF NOT EXISTS pausa_pronta_entrega jsonb`;

  console.log("3b-2) Endereços já convertidos em coordenadas...");
  await sql`
    CREATE TABLE IF NOT EXISTS geocache (
      chave text PRIMARY KEY,
      lat double precision,
      lng double precision,
      achou boolean NOT NULL DEFAULT true,
      fonte text NOT NULL DEFAULT 'osm',
      criado_em timestamptz NOT NULL DEFAULT now()
    )
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

  console.log("5) Login por e-mail (o CPF sai de cena)...");
  // Tudo em minúsculas: o login compara com o que a pessoa digitar, e
  // "Fulano@Gmail.com" e "fulano@gmail.com" são a mesma conta.
  await sql`UPDATE clientes SET email = lower(trim(email)) WHERE email <> lower(trim(email))`;

  // Trava de segurança: sem e-mail (ou com e-mail repetido) alguém ficaria
  // sem conseguir entrar. Melhor parar aqui do que descobrir depois.
  const problemas = await sql`
    SELECT
      count(*) FILTER (WHERE coalesce(trim(email), '') = '') AS sem_email,
      count(*) - count(DISTINCT email) AS repetidos
    FROM clientes
  `;
  const { sem_email: semEmail, repetidos } = problemas[0] as Record<string, number>;
  if (Number(semEmail) > 0 || Number(repetidos) > 0) {
    throw new Error(
      `Não dá pra migrar: ${semEmail} cliente(s) sem e-mail e ${repetidos} e-mail(s) repetido(s). ` +
        `Arrume esses cadastros antes de rodar de novo.`
    );
  }

  // O e-mail passa a ser a identidade da conta.
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS clientes_email_idx ON clientes (email)`;

  // O CPF deixa de ser obrigatório e deixa de ser único, pra parar de estorvar
  // quem se cadastra sem ele. Tudo dentro do "se a coluna existir": em
  // 2026-08-04 ela foi apagada de vez (`scripts/remover-coluna-cpf.ts`), e num
  // banco novo ela nunca chega a existir.
  await sql`
    DO $$
    DECLARE r record;
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'clientes' AND column_name = 'cpf'
      ) THEN
        ALTER TABLE clientes ALTER COLUMN cpf DROP NOT NULL;
        FOR r IN
          SELECT c.conname
          FROM pg_constraint c
          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
          WHERE c.conrelid = 'clientes'::regclass AND c.contype = 'u' AND a.attname = 'cpf'
        LOOP
          EXECUTE format('ALTER TABLE clientes DROP CONSTRAINT %I', r.conname);
        END LOOP;
      END IF;
    END $$
  `;

  console.log("6) Foto, recadinho e telefone da Camily no painel...");
  await sql`ALTER TABLE config_loja ADD COLUMN IF NOT EXISTS sobre_foto text NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE config_loja ADD COLUMN IF NOT EXISTS sobre_texto text NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE config_loja ADD COLUMN IF NOT EXISTS telefone text NOT NULL DEFAULT ''`;

  console.log("7) Ponto de retirada escolhido no pedido...");
  await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS ponto_retirada text`;

  console.log("8) Textos da política editáveis pelo painel...");
  await sql`
    ALTER TABLE config_loja
    ADD COLUMN IF NOT EXISTS politica jsonb NOT NULL DEFAULT '{}'::jsonb
  `;

  console.log("9) Pontos de retirada editáveis pelo painel...");
  await sql`
    ALTER TABLE config_loja
    ADD COLUMN IF NOT EXISTS pontos_retirada jsonb NOT NULL DEFAULT '[]'::jsonb
  `;

  console.log("10) Carrossel de banners no topo do cardápio...");
  await sql`
    ALTER TABLE config_loja
    ADD COLUMN IF NOT EXISTS banners jsonb NOT NULL DEFAULT '[]'::jsonb
  `;
  // O destaque único que já existia vira o primeiro banner da lista, pra
  // Camily não precisar cadastrar de novo o que já estava no ar.
  await sql`
    UPDATE config_loja
    SET banners = jsonb_build_array(jsonb_build_object(
      'id', 'banner-antigo',
      'ativo', banner_ativo,
      'titulo', banner_titulo,
      'descricao', banner_descricao,
      'selo', banner_selo,
      'imagem', banner_imagem,
      'link', coalesce(nullif(banner_link, ''), '/catalogo')
    ))
    WHERE banners = '[]'::jsonb
      AND (coalesce(banner_titulo, '') <> '' OR coalesce(banner_imagem, '') <> '')
  `;

  console.log("11) Cupom que só vale no Pix...");
  await sql`
    ALTER TABLE cupons
    ADD COLUMN IF NOT EXISTS somente_pix boolean NOT NULL DEFAULT false
  `;

  console.log("12) Desconto automatico de quem paga no Pix...");
  await sql`
    ALTER TABLE config_loja
    ADD COLUMN IF NOT EXISTS desconto_pix double precision NOT NULL DEFAULT 4
  `;
  await sql`
    ALTER TABLE pedidos
    ADD COLUMN IF NOT EXISTS desconto_pix double precision NOT NULL DEFAULT 0
  `;

  console.log("13) Cupom para varios clientes e cupom secreto...");
  await sql`
    ALTER TABLE cupons
    ADD COLUMN IF NOT EXISTS clientes_ids jsonb NOT NULL DEFAULT '[]'::jsonb
  `;
  await sql`
    ALTER TABLE cupons
    ADD COLUMN IF NOT EXISTS secreto boolean NOT NULL DEFAULT false
  `;
  // Cupom pessoal antigo (um dono só) entra na lista nova, pra tela do painel
  // mostrar do mesmo jeito quem já estava escolhido.
  await sql`
    UPDATE cupons
    SET clientes_ids = jsonb_build_array(cliente_id)
    WHERE clientes_ids = '[]'::jsonb AND cliente_id IS NOT NULL
  `;

  console.log("14) Horario de funcionamento da loja...");
  await sql`
    ALTER TABLE config_loja
    ADD COLUMN IF NOT EXISTS funcionamento jsonb NOT NULL
    DEFAULT '{"abreAs":9,"fechaAs":22,"ativo":true}'::jsonb
  `;

  console.log("15) Preco de promocao no doce e em cada recheio...");
  await sql`ALTER TABLE produtos ADD COLUMN IF NOT EXISTS preco_promocional double precision`;
  await sql`ALTER TABLE sabores ADD COLUMN IF NOT EXISTS preco_promocional double precision`;

  console.log("16) Frete: origem de fim de semana e frete gratis acima de X...");
  // Nulos de propósito: quem não configurou continua com a regra de antes —
  // sai sempre da origem única e o frete nunca é zerado por valor.
  await sql`ALTER TABLE config_frete ADD COLUMN IF NOT EXISTS origem_fim_de_semana jsonb`;
  await sql`ALTER TABLE config_frete ADD COLUMN IF NOT EXISTS frete_gratis_acima_de double precision`;

  console.log("17) Horario da ENTREGA (diferente do horario da loja)...");
  // Nulo cai no padrão de `lib/entrega-horario.ts` (seg-sex 9h-16h30,
  // sáb-dom 9h-22h), que foi o combinado com a Camily.
  await sql`ALTER TABLE config_loja ADD COLUMN IF NOT EXISTS entrega jsonb`;

  console.log("18) Aviso de novidade no pedido (o que a cliente ja viu)...");
  await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS status_visto text`;
  /*
   * Tudo que já existe nasce como LIDO.
   *
   * Sem isto, a bolinha estreia com o histórico inteiro: numa conta de teste
   * daqui ela apareceu com 17 avisos, de pedidos concluídos e cancelados
   * meses atrás. Aviso que já nasce velho é aviso que a pessoa aprende a
   * ignorar. Só o que mudar de aqui em diante acende.
   *
   * O pedido esperando pagamento continua aparecendo mesmo assim, e deve
   * mesmo: ali não é aviso de leitura, é coisa pendente pra fazer.
   */
  await sql`UPDATE pedidos SET status_visto = status WHERE status_visto IS NULL`;

  console.log("19) Carimbo de quando as promocoes mudaram...");
  await sql`ALTER TABLE config_loja ADD COLUMN IF NOT EXISTS promocoes_em timestamptz`;
  // Nasce com a data de agora: assim a bolinha não acende pra todo mundo por
  // causa de banner que já estava no ar antes desta coluna existir.
  await sql`UPDATE config_loja SET promocoes_em = now() WHERE promocoes_em IS NULL`;

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

  const sobre = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'config_loja'
      AND column_name IN ('sobre_foto', 'sobre_texto', 'telefone')
    ORDER BY column_name
  `;
  console.log("  config_loja (sobre):", sobre.map((c) => c.column_name).join(", ") || "NÃO CRIADAS");

  const emailUnico = await sql`SELECT to_regclass('public.clientes_email_idx') AS i`;
  console.log("  clientes.email único:", emailUnico[0].i ? "ok" : "NÃO CRIADO");
  const cpfObrigatorio = await sql`
    SELECT is_nullable FROM information_schema.columns
    WHERE table_name = 'clientes' AND column_name = 'cpf'
  `;
  console.log(
    "  clientes.cpf:",
    cpfObrigatorio.length === 0
      ? "coluna já removida"
      : cpfObrigatorio[0].is_nullable === "YES"
        ? "destravado (não é mais obrigatório)"
        : "AINDA OBRIGATÓRIO"
  );
  console.log("\nPronto.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
