"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CherryDivider from "@/components/CherryDivider";
import MeusPedidos from "@/components/conta/MeusPedidos";
import MeusDados from "@/components/conta/MeusDados";
import PontosECupons from "@/components/conta/PontosECupons";
import { sairCliente } from "@/lib/api";
import { limparCarrinho } from "@/lib/store";

/**
 * "Minha conta": pedidos, pontos/cupons e dados cadastrais.
 *
 * As três seções ficam em abas porque no celular uma página com tudo aberto
 * viraria uma rolagem sem fim — e o que a pessoa mais volta pra ver é o
 * andamento do pedido, que fica na primeira aba.
 */
const ABAS = [
  { id: "pedidos", rotulo: "Meus pedidos" },
  { id: "pontos", rotulo: "Pontos e cupons" },
  { id: "dados", rotulo: "Meus dados" },
] as const;

type Aba = (typeof ABAS)[number]["id"];

export default function ContaPage() {
  const [aba, setAba] = useState<Aba>("pedidos");

  /** Mesma saída do cabeçalho: encerra a sessão e limpa o carrinho local. */
  async function sair() {
    await sairCliente();
    limparCarrinho();
    window.location.assign("/catalogo");
  }

  /**
   * `?aba=dados` abre direto na aba dos dados. É o que faz o "Mudar meu
   * endereço fixo" do checkout cair no formulário certo — antes ele largava a
   * cliente em "Meus pedidos" e ela tinha que adivinhar onde continuar.
   *
   * Lido depois de montar, e não durante a renderização, pra o servidor e o
   * navegador não desenharem abas diferentes.
   */
  useEffect(() => {
    const pedida = new URLSearchParams(window.location.search).get("aba");
    if (ABAS.some((a) => a.id === pedida)) setAba(pedida as Aba);
  }, []);

  return (
    <>
      <Header />
      <main className="px-4 sm:px-6 md:px-12 pb-16 max-w-2xl mx-auto w-full">
        <h1 className="font-display text-2xl sm:text-3xl text-center text-cherryDark">
          Minha conta
        </h1>
        <CherryDivider />

        <div className="flex gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
          {ABAS.map((a) => (
            <button
              key={a.id}
              onClick={() => setAba(a.id)}
              className={`shrink-0 px-4 py-3 rounded-full text-sm font-body border transition-colors ${
                aba === a.id
                  ? "bg-cherryDark text-white border-cherryDark"
                  : "bg-white/70 text-ink/70 border-cherryLight/50 hover:border-cherryDark"
              }`}
            >
              {a.rotulo}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {aba === "pedidos" && <MeusPedidos />}
          {aba === "pontos" && <PontosECupons />}
          {aba === "dados" && <MeusDados />}
        </div>

        {/* Sair fica aqui embaixo: no celular o cabeçalho não tem espaço, e
            este é o lugar onde a pessoa mexe na conta. Em vermelho porque é
            uma ação de saída — antes era um link cinza que ninguém achava. */}
        <div className="mt-10 flex justify-center">
          <button
            onClick={sair}
            className="font-body text-sm font-semibold bg-cherryDark text-white rounded-full px-6 py-3 hover:bg-cherryMid active:scale-[0.98] transition-all"
          >
            Sair da minha conta
          </button>
        </div>
      </main>
      <Footer />
    </>
  );
}
