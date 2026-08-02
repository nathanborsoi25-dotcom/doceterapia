"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CampoNumero from "@/components/CampoNumero";
import EditorSabores from "@/components/EditorSabores";
import GaleriaFotos from "@/components/GaleriaFotos";
import { getProdutos, removerProduto, upsertProduto } from "@/lib/api";
import { fotosDoProduto } from "@/lib/fotos";
import type { Produto, SaborDoDoce } from "@/lib/types";

/** Doce com recheio guarda preço, custo e estoque em cada um deles. */
function temRecheios(produto: Produto): boolean {
  return (produto.sabores ?? []).length > 0;
}

export default function AdminProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  useEffect(() => {
    getProdutos()
      .then(setProdutos)
      .catch(() => setProdutos([]));
  }, []);

  function handleCampo(
    id: string,
    campo: keyof Produto,
    // `null` é um valor de verdade aqui: é o estoque "não controlado".
    valor: string | number | boolean | null | SaborDoDoce[]
  ) {
    setProdutos((prev) => prev.map((p) => (p.id === id ? { ...p, [campo]: valor } : p)));
  }

  /**
   * A galeria e a foto de capa andam juntas: a capa é sempre a primeira da
   * lista. Guardar as duas coisas em sincronia aqui evita que o cardápio
   * mostre uma foto que já foi removida da galeria.
   */
  function trocarFotos(id: string, fotos: string[]) {
    setProdutos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, fotos, fotoUrl: fotos[0] ?? "" } : p))
    );
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
    <main className="min-h-screen px-4 sm:px-6 md:px-12 py-8 md:py-10 max-w-3xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl sm:text-3xl text-cherryDark">Meus produtos</h1>
        <Link
          href="/admin/produtos/novo"
          className="text-sm text-cherryDark underline font-body py-3"
        >
          + Adicionar produto
        </Link>
      </div>

      <div className="grid gap-4 mt-6">
        {produtos.map((produto) => (
          <div key={produto.id} className="bg-white/70 border border-cherryLight/30 rounded-cherry p-3 sm:p-4 grid gap-2">
            <input
              value={produto.nome}
              onChange={(e) => handleCampo(produto.id, "nome", e.target.value)}
              className="w-full font-display text-lg bg-transparent border-b border-cherryLight/40 focus:outline-none py-1"
            />
            <textarea
              value={produto.descricao}
              onChange={(e) => handleCampo(produto.id, "descricao", e.target.value)}
              rows={3}
              className="w-full text-sm font-body bg-transparent border border-cherryLight/30 rounded-lg p-2"
            />
            {/*
              Doce COM recheios não tem preço, custo nem estoque próprios —
              quem manda são os recheios, e mostrar os dois lugares só criaria
              dúvida sobre qual vale. Sem recheios, é aqui que fica tudo.
            */}
            {temRecheios(produto) ? (
              <p className="text-xs font-body text-ink/60 bg-blush/40 border border-cherryLight/30 rounded-lg px-3 py-2">
                Preço, custo e estoque deste doce ficam em cada recheio, logo
                abaixo. 🍒
              </p>
            ) : (
              <>
                {/* Empilha no celular; volta a dividir a linha do tablet pra cima */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    value={produto.sabor}
                    onChange={(e) => handleCampo(produto.id, "sabor", e.target.value)}
                    placeholder="Sabor"
                    className="w-full text-sm font-body bg-transparent border border-cherryLight/30 rounded-lg p-2"
                  />
                  <label className="grid gap-0.5">
                    <span className="text-xs text-ink/50">Preço de venda (R$)</span>
                    <CampoNumero
                      valor={produto.preco}
                      onChange={(v) => handleCampo(produto.id, "preco", v ?? 0)}
                      className="w-full text-sm font-body bg-transparent border border-cherryLight/30 rounded-lg p-2"
                    />
                  </label>
                  {/* Sem o custo não dá pra calcular lucro nas métricas. */}
                  <label className="grid gap-0.5">
                    <span className="text-xs text-ink/50">Custo de produção (R$)</span>
                    <CampoNumero
                      valor={produto.custo ?? 0}
                      onChange={(v) => handleCampo(produto.id, "custo", v ?? 0)}
                      className={`w-full text-sm font-body bg-transparent border rounded-lg p-2 ${
                        (produto.custo ?? 0) <= 0
                          ? "border-amber-300 bg-amber-50/50"
                          : "border-cherryLight/30"
                      }`}
                    />
                  </label>
                </div>
              </>
            )}
            {/* Estoque: vazio = não controla (o doce nunca esgota sozinho);
                zero = esgotado, e o cardápio mostra a faixa em cima dele. */}
            {!temRecheios(produto) && (
              <label className="grid gap-0.5">
                <span className="text-xs text-ink/50">
                  Estoque — quantas unidades você tem
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <CampoNumero
                    valor={produto.estoque ?? null}
                    onChange={(v) =>
                      handleCampo(produto.id, "estoque", v == null ? null : Math.round(v))
                    }
                    casas={0}
                    placeholder="deixe vazio para não controlar"
                    className={`w-full sm:w-64 text-sm font-body bg-transparent border rounded-lg p-2 ${
                      produto.estoque === 0
                        ? "border-cherryDark bg-cherryDark/5"
                        : "border-cherryLight/30"
                    }`}
                  />
                  <span className="text-xs font-body">
                    {produto.estoque == null ? (
                      <span className="text-ink/45">sempre disponível</span>
                    ) : produto.estoque === 0 ? (
                      <span className="text-cherryDark font-semibold">
                        ESGOTADO no cardápio
                      </span>
                    ) : (
                      <span className="text-green-700">
                        {produto.estoque}{" "}
                        {produto.estoque === 1 ? "unidade à venda" : "unidades à venda"}
                      </span>
                    )}
                  </span>
                </div>
              </label>
            )}

            <GaleriaFotos
              fotos={fotosDoProduto(produto)}
              onChange={(fotos) => trocarFotos(produto.id, fotos)}
            />

            <EditorSabores
              produto={produto}
              sabores={produto.sabores ?? []}
              onChange={(sabores) => handleCampo(produto.id, "sabores", sabores)}
            />
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <select
                value={produto.disponibilidade}
                onChange={(e) => handleCampo(produto.id, "disponibilidade", e.target.value)}
                className="text-sm font-body border border-cherryLight/30 rounded-lg p-2 bg-white/70"
              >
                <option value="pronta_entrega">Pronta entrega</option>
                <option value="sob_encomenda">Sob encomenda</option>
              </select>
              {produto.disponibilidade === "sob_encomenda" && (
                <CampoNumero
                  valor={produto.prazoDias ?? 0}
                  onChange={(v) => handleCampo(produto.id, "prazoDias", Math.round(v ?? 0))}
                  casas={0}
                  placeholder="Prazo (dias)"
                  aria-label="Prazo em dias"
                  className="text-sm font-body border border-cherryLight/30 rounded-lg p-2 w-24"
                />
              )}
              <label className="text-sm font-body flex items-center gap-2 py-1 sm:ml-auto">
                <input
                  type="checkbox"
                  checked={produto.ativo}
                  onChange={(e) => handleCampo(produto.id, "ativo", e.target.checked)}
                  className="w-5 h-5 accent-cherryDark"
                />
                Ativo no cardápio
              </label>
            </div>
            <div className="flex gap-2 justify-end items-center">
              <button
                onClick={() => remover(produto.id)}
                className="text-sm text-red-600 font-body px-3 py-3 rounded-lg hover:bg-red-50"
              >
                Remover
              </button>
              <button
                onClick={() => salvar(produto)}
                disabled={salvandoId === produto.id}
                className="text-sm bg-cherryDark text-white rounded-full px-5 py-2.5 font-body font-semibold disabled:opacity-50"
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
