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
    <header className="w-full py-6 px-6 md:px-12 flex items-center justify-between">
      <Link href="/catalogo" className="font-display text-2xl md:text-3xl tracking-tight">
        <span className="text-cherryDark font-bold">doce</span>
        <span className="text-cherryLight">terapia</span>
      </Link>
      <nav className="flex gap-5 text-sm font-body text-ink/80 items-center">
        <Link href="/catalogo" className="hover:text-cherryDark transition-colors">
          Catálogo
        </Link>
        <Link href="/carrinho" className="hover:text-cherryDark transition-colors">
          Carrinho
        </Link>
        <button
          onClick={sair}
          className="text-ink/50 hover:text-cherryDark transition-colors"
        >
          Sair
        </button>
      </nav>
    </header>
  );
}
