import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, isValidSessionToken } from "./lib/auth";

/**
 * Protege TODAS as páginas /admin no servidor. Quem não tiver uma sessão
 * válida é mandado para a tela de login antes mesmo da página carregar.
 * (Os DADOS sensíveis têm uma trava separada nas rotas /api — ver
 * lib/require-admin.ts.)
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // A própria tela de login precisa ficar acessível.
  if (pathname === "/admin/login") return NextResponse.next();

  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  const ok = await isValidSessionToken(process.env.ADMIN_SESSION_SECRET, token);

  if (!ok) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
