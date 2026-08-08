"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import BannerPromocao from "@/components/BannerPromocao";
import CherryDivider from "@/components/CherryDivider";
import { getCategorias, getProdutos } from "@/lib/api";
import { agruparPorCategoria, categoriaDoProduto, categoriasDe } from "@/lib/catalogo";
import type { Produto } from "@/lib/types";

export default function CatalogoPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  /** Categoria escolhida. Vazio = mostra todas, agrupadas. */
  const [categoria, setCategoria] = useState("");

  /** Ordem das categorias definida pela Camily no painel. */
  const [ordemDaCamily, setOrdemDaCamily] = useState<string[]>([]);

  useEffect(() => {
    getProdutos()
      .then((lista) => setProdutos(lista.filter((p) => p.ativo)))
      .catch(() => setProdutos([]))
      .finally(() => setCarregando(false));
    getCategorias()
      .then((lista) => setOrdemDaCamily(lista.map((c) => c.nome)))
      .catch(() => setOrdemDaCamily([]));
  }, []);

  // A ordem das seções é a que a Camily montou no painel.
  const categorias = useMemo(
    () => categoriasDe(produtos, ordemDaCamily),
    [produtos, ordemDaCamily]
  );

  /**
   * Sem escolha, os doces vêm separados por categoria — assim a cliente vê
   * tudo que existe sem precisar rolar procurando. Escolhendo uma, só ela
   * fica; tocar de novo na mesma volta a mostrar o cardápio inteiro.
   */
  const secoes = useMemo(() => {
    const filtrados = categoria
      ? produtos.filter((p) => categoriaDoProduto(p) === categoria)
      : produtos;
    return agruparPorCategoria(filtrados, ordemDaCamily);
  }, [produtos, categoria, ordemDaCamily]);

  return (
    <>
      <Header />
      <main className="px-4 sm:px-6 md:px-12 pb-16">
        <h1 className="font-display text-2xl sm:text-3xl text-center text-cherryDark">
          Nosso cardápio de hoje
        </h1>
        <CherryDivider />
        <BannerPromocao />

        {/* Categorias: rolam na horizontal no celular, sem espremer. */}
        {categorias.length > 1 && (
          <div className="max-w-5xl mx-auto flex gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 mb-5">
            {categorias.map((c) => {
              const ativa = categoria === c;
              return (
                <button
                  key={c}
                  onClick={() => setCategoria(ativa ? "" : c)}
                  aria-pressed={ativa}
                  className={`shrink-0 px-4 py-2.5 rounded-full text-sm font-body border transition-colors ${
                    ativa
                      ? "bg-cherryDark text-white border-cherryDark"
                      : "bg-white/70 text-ink/70 border-cherryLight/50 hover:border-cherryDark"
                  }`}
                >
                  {c}
                  {ativa && <span className="ml-1.5 opacity-80">×</span>}
                </button>
              );
            })}
          </div>
        )}

        {carregando ? (
          <p className="text-center font-body text-ink/60">Carregando cardápio...</p>
        ) : produtos.length === 0 ? (
          <p className="text-center font-body text-ink/60">
            Nenhum doce no cardápio ainda.
          </p>
        ) : (
          <div className="max-w-5xl mx-auto grid gap-10">
            {secoes.map(({ categoria: nome, doces }) => (
              <section key={nome}>
                {/* Com uma categoria só, o título vira repetição do botão que
                    já está marcado ali em cima. */}
                {categorias.length > 1 && (
                  <h2 className="font-display text-xl sm:text-2xl text-cherryDark mb-4">
                    {nome}
                    <span className="font-body text-sm text-ink/45 ml-2">
                      {doces.length} {doces.length === 1 ? "doce" : "doces"}
                    </span>
                  </h2>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {doces.map((produto) => (
                    <ProductCard key={produto.id} produto={produto} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
