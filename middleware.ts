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

/**
 * A volta do Mercado Pago NÃO pode exigir login.
 *
 * Quem paga sai do site e volta por um link que o Mercado Pago monta. Nessa
 * volta o cookie de sessão muitas vezes não vem junto: o pagamento acontece
 * dentro do aplicativo do Mercado Pago, e o "voltar para a loja" abre o site
 * num contexto que não tem os cookies do navegador — sem contar que retorno
 * por POST também não carrega cookie `sameSite: lax`.
 *
 * O resultado era o pior possível: a pessoa pagava (ou desistia) e caía numa
 * tela de LOGIN, sem entender se o pedido tinha sido feito.
 *
 * Estas duas telas não mostram nada de ninguém — só dizem como foi o retorno —,
 * então podem ser abertas. Quem cuida dos dados do pedido continua sendo a
 * `/api`, que exige sessão.
 */
const VOLTA_DO_PAGAMENTO = ["/pedido/sucesso", "/pedido/erro"];

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

  if (VOLTA_DO_PAGAMENTO.includes(pathname)) return NextResponse.next();

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
