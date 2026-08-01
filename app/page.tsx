import { redirect } from "next/navigation";

/**
 * Porta de entrada do site: todo mundo cai direto no cardápio.
 *
 * Antes a primeira tela era o login, e quem chegava pelo Instagram tinha que
 * criar conta antes de ver um doce sequer — o jeito mais rápido de perder a
 * visita. Agora a conta só é pedida na hora de pagar.
 */
export default function Home() {
  redirect("/catalogo");
}
