"use client";

import Link from "next/link";
import Header from "@/components/Header";
import CherryDivider from "@/components/CherryDivider";

export default function PedidoErroPage() {
  return (
    <>
      <Header />
      <main className="px-6 md:px-12 pb-16 max-w-xl mx-auto text-center">
        <div className="text-5xl mt-6">😕</div>
        <h1 className="font-display text-3xl text-cherryDark mt-4">
          O pagamento não foi concluído
        </h1>
        <CherryDivider />
        <p className="font-body text-ink/80">
          Não se preocupe — nada foi cobrado. Você pode tentar de novo, escolher
          outra forma de pagamento, ou falar com a Camily pelo WhatsApp.
        </p>
        <div className="flex gap-3 justify-center mt-8">
          <Link
            href="/checkout"
            className="bg-cherryDark text-white rounded-full px-6 py-3 font-body font-semibold hover:bg-cherryMid transition-colors"
          >
            Tentar de novo
          </Link>
          <Link
            href="/carrinho"
            className="border border-cherryLight/60 text-cherryDark rounded-full px-6 py-3 font-body font-semibold hover:bg-blush transition-colors"
          >
            Ver carrinho
          </Link>
        </div>
      </main>
    </>
  );
}
