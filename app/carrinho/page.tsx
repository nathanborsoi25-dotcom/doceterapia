"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import CherryDivider from "@/components/CherryDivider";
import RodapeLinks from "@/components/RodapeLinks";
import { reais } from "@/lib/formato";
import { getProdutos } from "@/lib/api";
import { chaveDoItem } from "@/lib/sabores";
import { getCarrinho, salvarCarrinho } from "@/lib/store";
import type { ItemPedido } from "@/lib/types";

export default function CarrinhoPage() {
  const [itens, setItens] = useState<ItemPedido[]>([]);
  /** Estoque de cada doce agora — o carrinho pode ser de ontem. */
  const [estoques, setEstoques] = useState<Map<string, number | null>>(new Map());

  useEffect(() => {
    setItens(getCarrinho());
    getProdutos()
      .then((lista) => {
        // Um mapa só, com a mesma chave usada no carrinho: o doce sozinho e
        // cada recheio dele têm estoques diferentes.
        const mapa = new Map<string, number | null>();
        for (const p of lista) {
          mapa.set(chaveDoItem(p.id), p.estoque ?? null);
          for (const s of p.sabores ?? []) {
            mapa.set(chaveDoItem(p.id, s.id), s.estoque ?? null);
          }
        }
        setEstoques(mapa);
      })
      .catch(() => {});
  }, []);

  /**
   * Quantas unidades ainda dá pra levar (null = sem limite). Com recheio, o
   * limite é o do recheio — cada um tem o seu estoque.
   */
  function limite(item: ItemPedido): number | null {
    return estoques.get(chaveDoItem(item.produtoId, item.saborId)) ?? null;
  }

  function atualizarQuantidade(item: ItemPedido, delta: number) {
    const max = limite(item);
    const chave = chaveDoItem(item.produtoId, item.saborId);
    const novos = itens
      .map((i) => {
        if (chaveDoItem(i.produtoId, i.saborId) !== chave) return i;
        const desejada = i.quantidade + delta;
        // Não deixa passar do que existe pra vender: melhor avisar aqui do
        // que na hora de pagar, quando a pessoa já está com o cartão na mão.
        return { ...i, quantidade: max == null ? desejada : Math.min(desejada, max) };
      })
      .filter((i) => i.quantidade > 0);
    setItens(novos);
    salvarCarrinho(novos);
  }

  const total = itens.reduce((acc, i) => acc + i.precoUnitario * i.quantidade, 0);
  /** Algum doce do carrinho esgotou ou não tem quantidade suficiente. */
  const temProblema = itens.some((i) => {
    const max = limite(i);
    return max != null && i.quantidade > max;
  });

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
                key={chaveDoItem(item.produtoId, item.saborId)}
                className="flex items-center justify-between gap-3 bg-white/70 rounded-xl px-3 sm:px-4 py-3 border border-cherryLight/30"
              >
                <div className="min-w-0">
                  <p className="font-display text-ink truncate">{item.nome}</p>
                  {item.saborNome && (
                    <p className="text-xs text-cherryMid font-body">
                      Recheio: {item.saborNome}
                    </p>
                  )}
                  <p className="text-sm text-ink/60 font-body">
                    {reais(item.precoUnitario)} cada
                  </p>
                  {limite(item) === 0 ? (
                    <p className="text-xs font-body font-semibold text-cherryDark">
                      Esgotou — tire do carrinho para continuar
                    </p>
                  ) : limite(item) != null && item.quantidade > (limite(item) ?? 0) ? (
                    <p className="text-xs font-body font-semibold text-cherryDark">
                      Restam só {limite(item)} — ajuste a quantidade
                    </p>
                  ) : null}
                </div>
                {/* Botões de 44px: tamanho confortável para o dedo */}
                <div className="flex items-center gap-1 font-body shrink-0">
                  <button
                    onClick={() => atualizarQuantidade(item, -1)}
                    aria-label={`Tirar um ${item.nome}`}
                    className="w-11 h-11 rounded-full bg-blush text-cherryDark text-lg flex items-center justify-center active:scale-95 transition-transform"
                  >
                    −
                  </button>
                  <span className="w-8 text-center tabular-nums">{item.quantidade}</span>
                  <button
                    onClick={() => atualizarQuantidade(item, 1)}
                    aria-label={`Adicionar um ${item.nome}`}
                    disabled={limite(item) != null && item.quantidade >= (limite(item) ?? 0)}
                    className="w-11 h-11 rounded-full bg-blush text-cherryDark text-lg flex items-center justify-center active:scale-95 transition-transform disabled:opacity-35 disabled:active:scale-100"
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

            {temProblema ? (
              <p className="mt-2 text-center bg-blush/70 border border-cherryLight/50 rounded-xl py-3 px-4 font-body text-sm text-cherryDark">
                Ajuste os itens marcados acima para seguir para o pagamento.
              </p>
            ) : (
              <Link
                href="/checkout"
                className="mt-2 text-center bg-cherryDark text-white rounded-full py-3 font-body font-semibold hover:bg-cherryMid transition-colors"
              >
                Ir para entrega e pagamento
              </Link>
            )}
          </div>
        )}
      </main>
      <RodapeLinks />
    </>
  );
}
