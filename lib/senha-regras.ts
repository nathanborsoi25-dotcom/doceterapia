/**
 * Regras de senha compartilhadas entre a tela e o servidor. Fica separado de
 * lib/senha.ts porque aquele usa node:crypto e não pode ir para o navegador.
 */

export const SENHA_MINIMA = 6;

/** Devolve a mensagem de erro, ou null se a senha serve. */
export function validarSenha(senha: unknown): string | null {
  if (typeof senha !== "string" || senha.length < SENHA_MINIMA) {
    return `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`;
  }
  if (senha.length > 100) return "A senha é longa demais.";
  return null;
}
