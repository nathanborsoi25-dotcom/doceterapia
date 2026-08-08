"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getClienteLogado, sairCliente } from "@/lib/api";
import { EVENTO_CARRINHO, limparCarrinho, totalDeItens } from "@/lib/store";

/**
 * Cabeçalho do site.
 *
 * O cardápio é aberto: qualquer pessoa entra, olha os doces e monta o
 * carrinho sem conta nenhuma. Por isso o cabeçalho tem duas caras — quem não
 * está logada vê "Entrar", e quem está vê a conta dela. A conta só é exigida
 * na hora de pagar.
 */
export default function Header() {
  const [logado, setLogado] = useState<boolean | null>(null);
  const [itens, setItens] = useState(0);

  useEffect(() => {
    getClienteLogado()
      .then((c) => setLogado(Boolean(c)))
      .catch(() => setLogado(false));
  }, []);

  // Contador do carrinho: atualiza ao adicionar por aqui (evento próprio) e
  // também quando a pessoa mexe no carrinho em outra aba (evento storage).
  useEffect(() => {
    const atualizar = () => setItens(totalDeItens());
    atualizar();
    window.addEventListener(EVENTO_CARRINHO, atualizar);
    window.addEventListener("storage", atualizar);
    return () => {
      window.removeEventListener(EVENTO_CARRINHO, atualizar);
      window.removeEventListener("storage", atualizar);
    };
  }, []);

  async function sair() {
    await sairCliente();
    limparCarrinho();
    window.location.assign("/catalogo");
  }

  return (
    /*
     * `flex-wrap` em vez de esconder link.
     *
     * Numa tela de 375px (o iPhone mais comum) sobram uns 80px depois do logo
     * e do carrinho — não cabe "Cardápio" e "Sair" na mesma linha. A primeira
     * tentativa foi escondê-los no celular, e o resultado foi pior: os botões
     * simplesmente sumiam pra quem mais usa o site. Agora, quando não cabe, o
     * menu desce pra segunda linha e continua tudo à mão.
     */
    <header className="w-full py-3 sm:py-6 px-4 sm:px-6 md:px-12 flex flex-wrap items-center justify-between gap-x-2">
      <Link
        href="/catalogo"
        className="font-display text-xl sm:text-2xl md:text-3xl tracking-tight shrink-0 py-2"
      >
        <span className="text-cherryDark font-bold">doce</span>
        <span className="text-cherryLight">terapia</span>
      </Link>
      {/* py-3/px-2 dá área de toque confortável no dedo sem mudar o visual */}
      <nav className="flex flex-wrap gap-x-1 sm:gap-x-3 text-sm font-body text-ink/80 items-center ml-auto">
        <Link
          href="/catalogo"
          className="px-2 py-3 rounded-lg hover:text-cherryDark hover:bg-blush/60 transition-colors"
        >
          Cardápio
        </Link>
        {/*
         * O número fica AO LADO da palavra, não flutuando por cima dela.
         * Como bolinha absoluta no canto, ele montava em cima do texto e do
         * botão vizinho em tela de 320px — justamente onde o cabeçalho tem
         * menos espaço.
         */}
        <Link
          href="/carrinho"
          className="flex items-center gap-1.5 px-2 py-3 rounded-lg hover:text-cherryDark hover:bg-blush/60 transition-colors"
        >
          Carrinho
          {itens > 0 && (
            <span
              className="min-w-[20px] h-5 px-1 rounded-full bg-cherryDark text-white text-[11px] font-semibold flex items-center justify-center tabular-nums shrink-0"
              aria-label={`${itens} ${itens === 1 ? "item" : "itens"} no carrinho`}
            >
              {itens}
            </span>
          )}
        </Link>

        {/* Enquanto a resposta não chega, não mostra nada: piscar "Entrar"
            pra quem já está logada seria pior do que esperar um instante. */}
        {logado === true && (
          <>
            <Link
              href="/conta"
              className="px-2 py-3 rounded-lg hover:text-cherryDark hover:bg-blush/60 transition-colors"
            >
              <span className="hidden min-[420px]:inline">Minha conta</span>
              <span className="min-[420px]:hidden">Conta</span>
            </Link>
            <button
              onClick={sair}
              className="px-2 py-3 rounded-lg text-ink/50 hover:text-cherryDark hover:bg-blush/60 transition-colors"
            >
              Sair
            </button>
          </>
        )}

        {logado === false && (
          <Link
            href="/entrar"
            className="bg-cherryDark text-white rounded-full px-3 sm:px-4 py-3 font-semibold hover:bg-cherryMid transition-colors shrink-0"
          >
            Entrar
          </Link>
        )}
      </nav>
    </header>
  );
}
