import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, isValidSessionToken } from "./lib/auth";
import { COOKIE_CLIENTE, lerSessaoCliente } from "./lib/sessao-cliente";

/**
 * Duas portas trancadas no servidor:
 *  - /admin  -> só a Camily, com a senha do painel
 *  - a conta e o acompanhamento do pedido -> só cliente logado
 *
 * O cardápio, o carrinho e o checkout são ABERTOS de propósito: a pessoa
 * escolhe os doces e vê o valor da entrega sem precisar de conta. A conta só
 * entra na hora de pagar — quem faz essa exigência é a rota /api/pagamento,
 * que devolve 401 sem sessão. (Todos os DADOS têm travas próprias nas /api.)
 */

/** Telas que exigem cliente logado. */
const TELAS_DO_CLIENTE = ["/pedido", "/conta"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") return NextResponse.next();

    const token = req.cookies.get(ADMIN_COOKIE)?.value;
    if (await isValidSessionToken(secret, token)) return NextResponse.next();

    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  if (TELAS_DO_CLIENTE.some((t) => pathname === t || pathname.startsWith(`${t}/`))) {
    const cookie = req.cookies.get(COOKIE_CLIENTE)?.value;
    if (await lerSessaoCliente(secret, cookie)) return NextResponse.next();

    // Guarda de onde a pessoa veio, pra ela voltar pra cá depois de entrar.
    const url = req.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = `?voltar=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/pedido/:path*", "/conta"],
};
