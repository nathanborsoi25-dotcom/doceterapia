/**
 * Erros do banco traduzidos para decisões do código.
 *
 * O "único" do e-mail vive no banco, e não só na checagem que fazemos antes
 * de gravar: entre conferir e inserir existe um instante em que dois cadastros
 * podem passar juntos. Quando isso acontece, o Postgres recusa o segundo — e é
 * daqui que sai a resposta certa pra pessoa, em vez de um erro solto.
 */

/** Código do Postgres para "esse valor único já existe". */
const VALOR_REPETIDO = "23505";

export function emailJaExiste(erro: unknown): boolean {
  const e = erro as { code?: string; constraint?: string; message?: string } | null;
  if (e?.code !== VALOR_REPETIDO) return false;
  // O nome do índice (`clientes_email_idx`) vem no `constraint`; alguns
  // drivers só o trazem dentro da mensagem, por isso olhamos os dois.
  return `${e.constraint ?? ""} ${e.message ?? ""}`.includes("email");
}
