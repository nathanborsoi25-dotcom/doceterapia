"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import CherryDivider from "@/components/CherryDivider";
import { getProdutos } from "@/lib/api";
import type { Produto } from "@/lib/types";

export default function CatalogoPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    getProdutos()
      .then((lista) => setProdutos(lista.filter((p) => p.ativo)))
      .catch(() => setProdutos([]))
      .finally(() => setCarregando(false));
  }, []);

  return (
    <>
      <Header />
      <main className="px-6 md:px-12 pb-16">
        <h1 className="font-display text-3xl text-center text-cherryDark">
          Nosso cardápio de hoje
        </h1>
        <CherryDivider />
        {carregando ? (
          <p className="text-center font-body text-ink/60">Carregando cardápio...</p>
        ) : produtos.length === 0 ? (
          <p className="text-center font-body text-ink/60">
            Nenhum doce no cardápio ainda.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {produtos.map((produto) => (
              <ProductCard key={produto.id} produto={produto} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
