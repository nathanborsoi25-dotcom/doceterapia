import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, isValidSessionToken } from "./auth";

/**
 * Trava de servidor para as rotas de API sensíveis (dados de clientes e
 * pedidos, edição de produtos/frete). Chame no início do handler:
 *
 *   const negado = await requireAdmin();
 *   if (negado) return negado;
 *
 * Retorna uma resposta 401 quando NÃO está autenticado, ou null quando pode
 * seguir. Assim os dados só saem do servidor para quem tem sessão válida.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  const ok = await isValidSessionToken(process.env.ADMIN_SESSION_SECRET, token);
  return ok ? null : NextResponse.json({ error: "Não autorizado" }, { status: 401 });
}
