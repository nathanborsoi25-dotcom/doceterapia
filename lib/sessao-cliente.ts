/**
 * Sessão do cliente logado. O cookie guarda o id do cliente junto de uma
 * assinatura feita com a chave secreta do site — sem essa chave ninguém
 * consegue forjar um cookie e se passar por outra pessoa.
 *
 * Usa só Web Crypto, então funciona tanto no middleware quanto nas rotas.
 */

export const COOKIE_CLIENTE = "dt_cliente";

/** Prefixo próprio: garante que um cookie de cliente nunca valha como admin. */
const PREFIXO = "cliente-v1";

const encoder = new TextEncoder();

function paraHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function assinar(secret: string, mensagem: string): Promise<string> {
  const chave = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const assinatura = await crypto.subtle.sign(
    "HMAC",
    chave,
    encoder.encode(`${PREFIXO}:${mensagem}`)
  );
  return paraHex(assinatura);
}

function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Valor do cookie para um cliente: "id.assinatura". */
export async function criarSessaoCliente(
  secret: string,
  clienteId: string
): Promise<string> {
  return `${clienteId}.${await assinar(secret, clienteId)}`;
}

/**
 * Devolve o id do cliente se o cookie for legítimo, ou null.
 * Nunca confie no id sem passar por aqui.
 */
export async function lerSessaoCliente(
  secret: string | undefined,
  cookie: string | undefined
): Promise<string | null> {
  if (!secret || !cookie) return null;
  const separador = cookie.lastIndexOf(".");
  if (separador <= 0) return null;

  const clienteId = cookie.slice(0, separador);
  const assinatura = cookie.slice(separador + 1);
  const esperada = await assinar(secret, clienteId);
  return iguais(esperada, assinatura) ? clienteId : null;
}
