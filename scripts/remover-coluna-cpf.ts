import { neon } from "@neondatabase/serverless";

/**
 * ⚠️ DESTRUTIVO E SEM VOLTA: apaga a coluna `cpf` da tabela de clientes.
 *
 * Rodado uma vez, em 2026-08-04, depois que o login passou a ser por e-mail.
 * Fica versionado só como registro do que foi feito — rodar de novo não faz
 * nada (a coluna já não existe).
 *
 * O motivo é simples: a loja não precisa de CPF pra vender nem pra entregar.
 * Documento guardado sem uso não ajuda ninguém e, se um dia vazar, vazou à
 * toa. Antes de apagar, o script confere que ninguém depende mais dele.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/remover-coluna-cpf.ts
 */
async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  const coluna = await sql`
    SELECT is_nullable FROM information_schema.columns
    WHERE table_name = 'clientes' AND column_name = 'cpf'
  `;
  if (coluna.length === 0) {
    console.log("A coluna cpf já não existe. Nada a fazer.");
    return;
  }

  // Trava de segurança: se o e-mail ainda não for a identidade das contas,
  // apagar o CPF deixaria gente sem conseguir entrar.
  const emailUnico = await sql`SELECT to_regclass('public.clientes_email_idx') AS i`;
  if (!emailUnico[0].i) {
    throw new Error(
      "O e-mail ainda não é único (falta o índice clientes_email_idx). " +
        "Rode scripts/migrar.ts antes — apagar o CPF agora deixaria contas sem login."
    );
  }

  const [antes] = await sql`
    SELECT count(*)::int AS total,
           count(cpf)::int AS com_cpf
    FROM clientes
  `;
  console.log(`Clientes: ${antes.total} (com CPF gravado: ${antes.com_cpf})`);

  await sql`ALTER TABLE clientes DROP COLUMN cpf`;

  const depois = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'clientes' AND column_name = 'cpf'
  `;
  console.log(depois.length === 0 ? "Coluna cpf removida." : "ERRO: a coluna continua lá.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
