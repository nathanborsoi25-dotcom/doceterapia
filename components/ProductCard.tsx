"use client";

import type { Produto } from "@/lib/types";
import { adicionarAoCarrinho } from "@/lib/store";
import { useState } from "react";
import Estrelas from "./Estrelas";
import AvaliacoesDoProduto from "./AvaliacoesDoProduto";
import { reais } from "@/lib/formato";

export default function ProductCard({ produto }: { produto: Produto }) {
  const [adicionado, setAdicionado] = useState(false);

  // Estoque nulo = a Camily não controla este doce (ele nunca esgota).
  const esgotado = produto.estoque === 0;
  const poucasUnidades =
    produto.estoque != null && produto.estoque > 0 && produto.estoque <= 3;

  function handleAdicionar() {
    if (esgotado) return;
    adicionarAoCarrinho(produto);
    setAdicionado(true);
    setTimeout(() => setAdicionado(false), 1200);
  }

  return (
    /*
     * O arco lá em cima é a marca do card e fica como está. Embaixo o
     * arredondamento é suave, e o `overflow-hidden` saiu do card e foi só
     * pra foto: era ele que, junto com o canto de 999px, recortava o preço e
     * o botão "Adicionar" na base.
     */
    <div className="bg-white/70 rounded-t-[999px] rounded-br-3xl rounded-bl-md shadow-sm border border-cherryLight/30 flex flex-col">
      <div className="relative aspect-square bg-blush flex items-center justify-center text-5xl overflow-hidden rounded-t-[999px]">
        {produto.fotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={produto.fotoUrl}
            alt={produto.nome}
            className={`w-full h-full object-cover ${esgotado ? "opacity-40 grayscale" : ""}`}
          />
        ) : (
          "🍰"
        )}

        {/* Faixa atravessada de esgotado: some da dúvida antes de a pessoa
            se animar com o doce e só descobrir no carrinho. */}
        {esgotado && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="w-[140%] -rotate-12 bg-cherryDark/95 text-white text-center font-body font-bold tracking-wide py-2 shadow-lg">
              ESGOTADO
            </span>
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col gap-1 flex-1">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg text-cherryDark">{produto.nome}</h3>
          <span
            className={`text-xs px-2 py-1 rounded-full font-body ${
              produto.disponibilidade === "pronta_entrega"
                ? "bg-green-100 text-green-700"
                : "bg-cherryLight/30 text-cherryDark"
            }`}
          >
            {produto.disponibilidade === "pronta_entrega"
              ? "Pronta entrega"
              : `Sob encomenda${produto.prazoDias ? ` · ${produto.prazoDias}d` : ""}`}
          </span>
        </div>
        {/* Nota dos clientes logo abaixo do nome: é o que mais pesa na hora
            de escolher um doce que a pessoa nunca provou. */}
        {(produto.totalAvaliacoes ?? 0) > 0 && (
          <div className="flex items-center gap-1.5">
            <Estrelas nota={produto.notaMedia ?? 0} tamanho="sm" />
            <span className="text-xs text-ink/60 font-body">
              {(produto.notaMedia ?? 0).toFixed(1).replace(".", ",")} (
              {produto.totalAvaliacoes})
            </span>
          </div>
        )}
        <p className="text-sm text-ink/70 font-body flex-1">{produto.descricao}</p>
        <p className="text-xs text-cherryMid font-body">Sabor: {produto.sabor}</p>
        {/* "Só restam 2" acelera a decisão de quem está em dúvida — e é
            verdade, não é pressão inventada. */}
        {poucasUnidades && (
          <p className="text-xs font-body font-semibold text-cherryDark">
            {produto.estoque === 1
              ? "Só resta 1 unidade!"
              : `Só restam ${produto.estoque} unidades!`}
          </p>
        )}
        <AvaliacoesDoProduto
          produtoId={produto.id}
          total={produto.totalAvaliacoes ?? 0}
        />
        <div className="flex items-center justify-between gap-2 mt-2">
          <span className="font-display text-lg text-ink shrink-0">
            {reais(produto.preco)}
          </span>
          <button
            onClick={handleAdicionar}
            disabled={esgotado}
            className={`text-sm rounded-full px-5 py-3 font-body font-semibold transition-all ${
              esgotado
                ? "bg-ink/15 text-ink/45 cursor-not-allowed"
                : "bg-cherryDark text-white hover:bg-cherryMid active:scale-95"
            }`}
          >
            {esgotado ? "Esgotado" : adicionado ? "Adicionado ✓" : "Adicionar"}
          </button>
        </div>
      </div>
    </div>
  );
}
