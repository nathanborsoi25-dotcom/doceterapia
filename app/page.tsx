import { redirect } from "next/navigation";
import { getClienteLogado } from "@/lib/cliente-logado";

export const dynamic = "force-dynamic";

/**
 * Porta de entrada do site: quem já está logado vai direto pro cardápio,
 * quem não está cai na tela de login. A decisão é tomada no servidor, então
 * não pisca uma tela antes da outra.
 */
export default async function Home() {
  const cliente = await getClienteLogado();
  redirect(cliente ? "/catalogo" : "/entrar");
}
