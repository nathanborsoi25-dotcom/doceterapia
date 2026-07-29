import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { clientes } from "./db/schema";
import { COOKIE_CLIENTE, lerSessaoCliente } from "./sessao-cliente";

/**
 * Descobre quem é o cliente logado a partir do cookie de sessão, indo buscar
 * os dados no banco. Devolve null se ninguém estiver logado.
 *
 * É esta função (e não o que vem do navegador) que as rotas devem usar pra
 * saber de quem é o pedido.
 */
export async function getClienteLogado() {
  const cookie = cookies().get(COOKIE_CLIENTE)?.value;
  const id = await lerSessaoCliente(process.env.ADMIN_SESSION_SECRET, cookie);
  if (!id) return null;

  const [cliente] = await getDb()
    .select()
    .from(clientes)
    .where(eq(clientes.id, id));
  return cliente ?? null;
}

/** Cookie de sessão do cliente: 60 dias, inacessível ao JavaScript da página. */
export const OPCOES_COOKIE = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 60,
} as const;
