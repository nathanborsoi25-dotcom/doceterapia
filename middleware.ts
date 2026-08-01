import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, isValidSessionToken } from "./lib/auth";
import { COOKIE_CLIENTE, lerSessaoCliente } from "./lib/sessao-cliente";

/**
 * Duas portas trancadas no servidor:
 *  - /admin  -> só a Camily, com a senha do painel
 *  - as telas de compra -> só cliente logado
 * Quem não tem sessão válida é mandado para a tela de login certa antes
 * mesmo da página carregar. (Os DADOS têm travas próprias nas rotas /api.)
 */

/** Telas que exigem cliente logado. */
const TELAS_DO_CLIENTE = ["/catalogo", "/carrinho", "/checkout", "/pedido", "/conta"];

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

    const url = req.nextUrl.clone();
    url.pathname = "/entrar";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/catalogo/:path*",
    "/catalogo",
    "/carrinho",
    "/checkout",
    "/pedido/:path*",
    "/conta",
  ],
};
