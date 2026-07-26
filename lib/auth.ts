/**
 * Miolo da autenticação do admin. Usa apenas Web Crypto (funciona tanto no
 * middleware/Edge quanto nas rotas de API em Node), sem dependências externas.
 *
 * A ideia: quando a senha do admin está correta, gravamos um cookie seguro
 * (httpOnly) cujo valor é uma "assinatura" feita com uma chave secreta
 * (ADMIN_SESSION_SECRET). Sem essa chave ninguém consegue forjar o cookie.
 * A senha em si (ADMIN_PASSWORD) nunca vai pro navegador nem pro código.
 */

export const ADMIN_COOKIE = "dt_admin";

// Conteúdo fixo assinado. Trocar a versão invalida todas as sessões antigas.
const PAYLOAD = "doceterapia-admin-v1";

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return toHex(signature);
}

/** Comparação em tempo constante (evita ataques de timing). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Gera o valor do cookie de sessão a partir da chave secreta. */
export async function makeSessionToken(secret: string): Promise<string> {
  return hmac(secret, PAYLOAD);
}

/** Confere se um cookie de sessão é válido para a chave secreta atual. */
export async function isValidSessionToken(
  secret: string | undefined,
  token: string | undefined
): Promise<boolean> {
  if (!secret || !token) return false;
  const expected = await hmac(secret, PAYLOAD);
  return safeEqual(expected, token);
}
