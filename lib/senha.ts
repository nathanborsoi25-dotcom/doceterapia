import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Guarda e confere senhas com scrypt — o algoritmo de hash de senha que já
 * vem no Node, sem precisar instalar nada. A senha em texto puro NUNCA é
 * gravada: o banco só vê o hash, e nem nós conseguimos descobrir a senha
 * original a partir dele.
 *
 * Só use no servidor (rotas /api), nunca no navegador.
 */

const scryptAsync = promisify(scrypt) as (
  senha: string,
  sal: Buffer,
  tamanho: number
) => Promise<Buffer>;

const TAMANHO_SAL = 16;
const TAMANHO_HASH = 64;

// As regras (tamanho mínimo etc.) ficam em lib/senha-regras.ts, que a tela
// também importa — este arquivo aqui é só servidor, por causa do node:crypto.
export { SENHA_MINIMA, validarSenha } from "./senha-regras";

/** Gera o hash que vai pro banco, no formato "sal:hash" (ambos em hex). */
export async function gerarHashSenha(senha: string): Promise<string> {
  const sal = randomBytes(TAMANHO_SAL);
  const hash = await scryptAsync(senha, sal, TAMANHO_HASH);
  return `${sal.toString("hex")}:${hash.toString("hex")}`;
}

/** Confere uma senha digitada contra o hash guardado. */
export async function conferirSenha(
  senha: string,
  guardado: string | null | undefined
): Promise<boolean> {
  if (!guardado) return false;
  const [salHex, hashHex] = guardado.split(":");
  if (!salHex || !hashHex) return false;

  try {
    const esperado = Buffer.from(hashHex, "hex");
    const calculado = await scryptAsync(
      senha,
      Buffer.from(salHex, "hex"),
      esperado.length
    );
    // Comparação em tempo constante, pra não vazar informação pelo tempo.
    return timingSafeEqual(esperado, calculado);
  } catch {
    return false;
  }
}

