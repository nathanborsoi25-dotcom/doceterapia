"use client";

import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CherryDivider from "@/components/CherryDivider";
import MeusPedidos from "@/components/conta/MeusPedidos";
import MeusDados from "@/components/conta/MeusDados";
import PontosECupons from "@/components/conta/PontosECupons";

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

  return (
    <>
      <Header />
      <main className="px-4 sm:px-6 md:px-12 pb-16 max-w-2xl mx-auto w-full">
        <h1 className="font-display text-2xl sm:text-3xl text-center text-cherryDark">
          Minha conta
        </h1>
        <CherryDivider />

        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
          {ABAS.map((a) => (
            <button
              key={a.id}
              onClick={() => setAba(a.id)}
              className={`shrink-0 px-4 py-2.5 rounded-full text-sm font-body border transition-colors ${
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
      </main>
      <Footer />
    </>
  );
}
