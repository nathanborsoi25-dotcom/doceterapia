"use client";

import Link from "next/link";
import { temaNatalino } from "@/lib/tema-da-loja";

/**
 * Cabeçalho do site: só a marca.
 *
 * Os atalhos (cardápio, carrinho, conta, entrar e sair) saíram daqui e foram
 * para a barra fixa do rodapé — no celular, que é de onde vem quase todo
 * acesso, o alto da tela é onde o polegar NÃO alcança. Ter os mesmos caminhos
 * nos dois lugares só roubava espaço e obrigava a decidir duas vezes.
 *
 * O "Sair" agora mora dentro de "Minha conta", que é onde a pessoa mexe na
 * conta dela.
 */
export default function Header() {
  return (
    /*
     * A marca fica sozinha e no meio, em tamanho grande: agora que os atalhos
     * desceram pro rodapé, o topo é só a assinatura da loja — e é a primeira
     * coisa que quem chega pelo Instagram vê.
     */
    <header className={`w-full py-4 sm:py-6 px-4 sm:px-6 md:px-12 flex justify-center${temaNatalino ? " natal-cabecalho" : ""}`}>
      <Link
        href="/catalogo"
        aria-label="Doceterapia — ir para o cardápio"
        className="natal-logotipo font-display text-3xl sm:text-4xl md:text-5xl tracking-tight py-1"
      >
        {temaNatalino && <span aria-hidden="true" className="natal-marca-enfeite">✦</span>}
        <span className="text-cherryDark font-bold">
          doce
          {temaNatalino && <span className="natal-gorro" aria-hidden="true" />}
        </span>
        <span className="text-cherryLight natal-marca">terapia</span>
        {temaNatalino && <span aria-hidden="true" className="natal-marca-enfeite">✦</span>}
      </Link>
    </header>
  );
}
