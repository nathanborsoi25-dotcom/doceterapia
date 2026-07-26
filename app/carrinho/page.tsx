"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import CherryDivider from "@/components/CherryDivider";
import { getCarrinho, salvarCarrinho } from "@/lib/store";
import type { ItemPedido } from "@/lib/types";

export default function CarrinhoPage() {
  const [itens, setItens] = useState<ItemPedido[]>([]);

  useEffect(() => {
    setItens(getCarrinho());
  }, []);

  function atualizarQuantidade(produtoId: string, delta: number) {
    const novos = itens
      .map((i) =>
        i.produtoId === produtoId ? { ...i, quantidade: i.quantidade + delta } : i
      )
      .filter((i) => i.quantidade > 0);
    setItens(novos);
    salvarCarrinho(novos);
  }

  const total = itens.reduce((acc, i) => acc + i.precoUnitario * i.quantidade, 0);

  return (
    <>
      <Header />
      <main className="px-6 md:px-12 pb-16 max-w-2xl mx-auto">
        <h1 className="font-display text-3xl text-center text-cherryDark">Seu carrinho</h1>
        <CherryDivider />

        {itens.length === 0 ? (
          <p className="text-center font-body text-ink/70">
            Seu carrinho está vazio.{" "}
            <Link href="/catalogo" className="text-cherryDark underline">
              Ver cardápio
            </Link>
          </p>
        ) : (
          <div className="grid gap-4">
            {itens.map((item) => (
              <div
                key={item.produtoId}
                className="flex items-center justify-between bg-white/70 rounded-xl px-4 py-3 border border-cherryLight/30"
              >
                <div>
                  <p className="font-display text-ink">{item.nome}</p>
                  <p className="text-sm text-ink/60 font-body">
                    R$ {item.precoUnitario.toFixed(2)} cada
                  </p>
                </div>
                <div className="flex items-center gap-3 font-body">
                  <button
                    onClick={() => atualizarQuantidade(item.produtoId, -1)}
                    className="w-7 h-7 rounded-full bg-blush text-cherryDark"
                  >
                    −
                  </button>
                  <span>{item.quantidade}</span>
                  <button
                    onClick={() => atualizarQuantidade(item.produtoId, 1)}
                    className="w-7 h-7 rounded-full bg-blush text-cherryDark"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}

            <div className="flex justify-between font-display text-lg mt-4">
              <span>Subtotal</span>
              <span>R$ {total.toFixed(2)}</span>
            </div>
            <p className="text-xs text-ink/50 font-body -mt-2">
              O frete é calculado na próxima etapa, de acordo com a distância
              ou a retirada.
            </p>

            <Link
              href="/checkout"
              className="mt-2 text-center bg-cherryDark text-white rounded-full py-3 font-body font-semibold hover:bg-cherryMid transition-colors"
            >
              Ir para entrega e pagamento
            </Link>
          </div>
        )}
      </main>
    </>
  );
}
