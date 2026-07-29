"use client";

import Link from "next/link";
import { sairCliente } from "@/lib/api";
import { limparCarrinho } from "@/lib/store";

export default function Header() {
  async function sair() {
    await sairCliente();
    limparCarrinho();
    window.location.assign("/entrar");
  }

  return (
    <header className="w-full py-4 sm:py-6 px-4 sm:px-6 md:px-12 flex items-center justify-between gap-2">
      <Link
        href="/catalogo"
        className="font-display text-xl sm:text-2xl md:text-3xl tracking-tight shrink-0 py-2"
      >
        <span className="text-cherryDark font-bold">doce</span>
        <span className="text-cherryLight">terapia</span>
      </Link>
      {/* py-3/px-2 dá área de toque confortável no dedo sem mudar o visual */}
      <nav className="flex gap-1 sm:gap-3 text-sm font-body text-ink/80 items-center">
        {/* Em telas bem estreitas (iPhone SE) este link some: o próprio logo
            já leva ao catálogo, e assim o cabeçalho não estoura. */}
        <Link
          href="/catalogo"
          className="hidden min-[360px]:inline-block px-2 py-3 rounded-lg hover:text-cherryDark hover:bg-blush/60 transition-colors"
        >
          Catálogo
        </Link>
        <Link
          href="/carrinho"
          className="px-2 py-3 rounded-lg hover:text-cherryDark hover:bg-blush/60 transition-colors"
        >
          Carrinho
        </Link>
        <button
          onClick={sair}
          className="px-2 py-3 rounded-lg text-ink/50 hover:text-cherryDark hover:bg-blush/60 transition-colors"
        >
          Sair
        </button>
      </nav>
    </header>
  );
}
