"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getProdutos, removerProduto, upsertProduto } from "@/lib/api";
import type { Produto } from "@/lib/types";

export default function AdminProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  useEffect(() => {
    getProdutos()
      .then(setProdutos)
      .catch(() => setProdutos([]));
  }, []);

  function handleCampo(id: string, campo: keyof Produto, valor: string | number | boolean) {
    setProdutos((prev) => prev.map((p) => (p.id === id ? { ...p, [campo]: valor } : p)));
  }

  async function salvar(produto: Produto) {
    setSalvandoId(produto.id);
    try {
      await upsertProduto(produto);
    } finally {
      setSalvandoId(null);
    }
  }

  async function remover(id: string) {
    await removerProduto(id);
    setProdutos((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <main className="min-h-screen px-6 md:px-12 py-10 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-cherryDark">Meus produtos</h1>
        <Link href="/admin/produtos/novo" className="text-sm text-cherryDark underline font-body">
          + Adicionar produto
        </Link>
      </div>

      <div className="grid gap-4 mt-6">
        {produtos.map((produto) => (
          <div key={produto.id} className="bg-white/70 border border-cherryLight/30 rounded-cherry p-4 grid gap-2">
            <input
              value={produto.nome}
              onChange={(e) => handleCampo(produto.id, "nome", e.target.value)}
              className="font-display text-lg bg-transparent border-b border-cherryLight/40 focus:outline-none"
            />
            <textarea
              value={produto.descricao}
              onChange={(e) => handleCampo(produto.id, "descricao", e.target.value)}
              className="text-sm font-body bg-transparent border border-cherryLight/30 rounded-lg p-2"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={produto.sabor}
                onChange={(e) => handleCampo(produto.id, "sabor", e.target.value)}
                placeholder="Sabor"
                className="text-sm font-body bg-transparent border border-cherryLight/30 rounded-lg p-2"
              />
              <input
                type="number"
                step="0.01"
                value={produto.preco}
                onChange={(e) => handleCampo(produto.id, "preco", parseFloat(e.target.value) || 0)}
                placeholder="Preço"
                className="text-sm font-body bg-transparent border border-cherryLight/30 rounded-lg p-2"
              />
            </div>
            <input
              value={produto.fotoUrl}
              onChange={(e) => handleCampo(produto.id, "fotoUrl", e.target.value)}
              placeholder="URL da foto"
              className="text-sm font-body bg-transparent border border-cherryLight/30 rounded-lg p-2"
            />
            <div className="flex items-center gap-3">
              <select
                value={produto.disponibilidade}
                onChange={(e) => handleCampo(produto.id, "disponibilidade", e.target.value)}
                className="text-sm font-body border border-cherryLight/30 rounded-lg p-2"
              >
                <option value="pronta_entrega">Pronta entrega</option>
                <option value="sob_encomenda">Sob encomenda</option>
              </select>
              {produto.disponibilidade === "sob_encomenda" && (
                <input
                  type="number"
                  value={produto.prazoDias ?? 0}
                  onChange={(e) => handleCampo(produto.id, "prazoDias", parseInt(e.target.value) || 0)}
                  placeholder="Prazo (dias)"
                  className="text-sm font-body border border-cherryLight/30 rounded-lg p-2 w-28"
                />
              )}
              <label className="text-sm font-body flex items-center gap-1 ml-auto">
                <input
                  type="checkbox"
                  checked={produto.ativo}
                  onChange={(e) => handleCampo(produto.id, "ativo", e.target.checked)}
                />
                Ativo no cardápio
              </label>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => remover(produto.id)}
                className="text-sm text-red-600 font-body"
              >
                Remover
              </button>
              <button
                onClick={() => salvar(produto)}
                disabled={salvandoId === produto.id}
                className="text-sm bg-cherryDark text-white rounded-full px-4 py-1.5 font-body disabled:opacity-50"
              >
                {salvandoId === produto.id ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
