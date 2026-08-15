"use client";

import Link from "next/link";
import IconeInstagram from "./IconeInstagram";
import { linkInstagram } from "@/lib/contato";
import { useSobre } from "@/lib/usar-sobre";

/**
 * Rodapé enxuto para as telas que não levam o rodapé grande (login, carrinho,
 * checkout...). Existe pra regra de cancelamento e reembolso estar a um toque
 * de distância em qualquer tela — inclusive na hora de pagar, que é justo
 * quando bate a dúvida de "e se eu desistir?".
 */
export default function RodapeLinks() {
  const { linkWhatsApp } = useSobre();

  return (
    <footer className="mt-10 pb-8 px-4 text-center font-body text-xs text-ink/50">
      <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <Link href="/loja" className="underline inline-flex items-center min-h-[44px] px-1 hover:text-cherryDark">
          Sobre a loja
        </Link>
        <Link href="/politica" className="underline inline-flex items-center min-h-[44px] px-1 hover:text-cherryDark">
          Cancelamento e reembolso
        </Link>
        <a
          href={linkWhatsApp("Oi, Camily! Tenho uma dúvida sobre o site da Doceterapia.")}
          target="_blank"
          rel="noopener noreferrer"
          className="underline inline-flex items-center min-h-[44px] px-1 hover:text-cherryDark"
        >
          Falar com a Camily
        </a>
        {/* Aqui o ícone vem junto do texto: nesta fileira tudo é link escrito,
            e um símbolo sozinho no meio deles não se lê como "Instagram". */}
        <a
          href={linkInstagram()}
          target="_blank"
          rel="noopener noreferrer"
          className="underline inline-flex items-center gap-1.5 min-h-[44px] px-1 hover:text-cherryDark"
        >
          <IconeInstagram className="w-4 h-4 text-[#DD2A7B]" />
          Instagram
        </a>
      </nav>
      <p className="mt-2">Doceterapia — Arapongas-PR</p>
    </footer>
  );
}
