"use client";

import Link from "next/link";
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
        <Link href="/politica" className="underline py-2 hover:text-cherryDark">
          Cancelamento e reembolso
        </Link>
        <a
          href={linkWhatsApp("Oi, Camily! Tenho uma dúvida sobre o site da Doceterapia.")}
          target="_blank"
          rel="noopener noreferrer"
          className="underline py-2 hover:text-cherryDark"
        >
          Falar com a Camily
        </a>
      </nav>
      <p className="mt-2">Doceterapia — Arapongas-PR</p>
    </footer>
  );
}
