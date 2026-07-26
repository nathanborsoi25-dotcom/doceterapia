"use client";

import { useEffect } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import CherryDivider from "@/components/CherryDivider";
import { limparCarrinho } from "@/lib/store";

export default function PedidoSucessoPage() {
  useEffect(() => {
    // O pagamento foi iniciado/aprovado — pode esvaziar o carrinho.
    limparCarrinho();
  }, []);

  return (
    <>
      <Header />
      <main className="px-6 md:px-12 pb-16 max-w-xl mx-auto text-center">
        <div className="text-5xl mt-6">🍒</div>
        <h1 className="font-display text-3xl text-cherryDark mt-4">
          Pedido confirmado!
        </h1>
        <CherryDivider />
        <p className="font-body text-ink/80">
          Recebemos seu pedido. Assim que o pagamento for confirmado, a Camily
          começa a preparar tudo com carinho. Você pode combinar os detalhes da
          entrega ou retirada pelo WhatsApp.
        </p>
        <p className="font-body text-sm text-ink/60 mt-3">
          Se você pagou com Pix, a confirmação pode levar alguns instantes.
        </p>
        <Link
          href="/catalogo"
          className="inline-block mt-8 bg-cherryDark text-white rounded-full px-6 py-3 font-body font-semibold hover:bg-cherryMid transition-colors"
        >
          Voltar ao cardápio
        </Link>
      </main>
    </>
  );
}
