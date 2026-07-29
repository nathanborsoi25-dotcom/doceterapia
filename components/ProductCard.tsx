"use client";

import type { Produto } from "@/lib/types";
import { adicionarAoCarrinho } from "@/lib/store";
import { useState } from "react";

export default function ProductCard({ produto }: { produto: Produto }) {
  const [adicionado, setAdicionado] = useState(false);

  function handleAdicionar() {
    adicionarAoCarrinho(produto);
    setAdicionado(true);
    setTimeout(() => setAdicionado(false), 1200);
  }

  return (
    <div className="bg-white/70 rounded-cherry overflow-hidden shadow-sm border border-cherryLight/30 flex flex-col">
      <div className="aspect-square bg-blush flex items-center justify-center text-5xl">
        {produto.fotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={produto.fotoUrl} alt={produto.nome} className="w-full h-full object-cover" />
        ) : (
          "🍰"
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
        <p className="text-sm text-ink/70 font-body flex-1">{produto.descricao}</p>
        <p className="text-xs text-cherryMid font-body">Sabor: {produto.sabor}</p>
        <div className="flex items-center justify-between gap-2 mt-2">
          <span className="font-display text-lg text-ink shrink-0">
            R$ {produto.preco.toFixed(2)}
          </span>
          <button
            onClick={handleAdicionar}
            className="bg-cherryDark text-white text-sm rounded-full px-5 py-3 font-body font-semibold hover:bg-cherryMid active:scale-95 transition-all"
          >
            {adicionado ? "Adicionado ✓" : "Adicionar"}
          </button>
        </div>
      </div>
    </div>
  );
}
