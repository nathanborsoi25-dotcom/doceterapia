"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import CherryDivider from "@/components/CherryDivider";
import RodapeLinks from "@/components/RodapeLinks";
import { reais } from "@/lib/formato";
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
      <main className="px-4 sm:px-6 md:px-12 pb-16 max-w-2xl mx-auto">
        <h1 className="font-display text-2xl sm:text-3xl text-center text-cherryDark">Seu carrinho</h1>
        <CherryDivider />

        {itens.length === 0 ? (
          <p className="text-center font-body text-ink/70">
            Seu carrinho está vazio.{" "}
            <Link href="/catalogo" className="text-cherryDark underline inline-block py-3 px-1">
              Ver cardápio
            </Link>
          </p>
        ) : (
          <div className="grid gap-4">
            {itens.map((item) => (
              <div
                key={item.produtoId}
                className="flex items-center justify-between gap-3 bg-white/70 rounded-xl px-3 sm:px-4 py-3 border border-cherryLight/30"
              >
                <div className="min-w-0">
                  <p className="font-display text-ink truncate">{item.nome}</p>
                  <p className="text-sm text-ink/60 font-body">
                    {reais(item.precoUnitario)} cada
                  </p>
                </div>
                {/* Botões de 44px: tamanho confortável para o dedo */}
                <div className="flex items-center gap-1 font-body shrink-0">
                  <button
                    onClick={() => atualizarQuantidade(item.produtoId, -1)}
                    aria-label={`Tirar um ${item.nome}`}
                    className="w-11 h-11 rounded-full bg-blush text-cherryDark text-lg flex items-center justify-center active:scale-95 transition-transform"
                  >
                    −
                  </button>
                  <span className="w-8 text-center tabular-nums">{item.quantidade}</span>
                  <button
                    onClick={() => atualizarQuantidade(item.produtoId, 1)}
                    aria-label={`Adicionar um ${item.nome}`}
                    className="w-11 h-11 rounded-full bg-blush text-cherryDark text-lg flex items-center justify-center active:scale-95 transition-transform"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}

            <div className="flex justify-between font-display text-lg mt-4">
              <span>Subtotal</span>
              <span>{reais(total)}</span>
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
      <RodapeLinks />
    </>
  );
}
