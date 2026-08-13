"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import BannerPromocao from "@/components/BannerPromocao";
import CherryDivider from "@/components/CherryDivider";
import { getCategorias, getProdutos } from "@/lib/api";
import { agruparPorCategoria, categoriaDoProduto, categoriasDe } from "@/lib/catalogo";
import type { Produto } from "@/lib/types";

/** Vira "tortas-de-chocolate" — serve de id da seção e de alvo do atalho. */
function idDaSecao(categoria: string): string {
  return `cat-${categoria
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

export default function CatalogoPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);

  /** Ordem das categorias definida pela Camily no painel. */
  const [ordemDaCamily, setOrdemDaCamily] = useState<string[]>([]);

  /**
   * Qual categoria está passando pela tela agora.
   *
   * Antes tocar numa categoria ESCONDIA todas as outras. Agora ela funciona
   * como atalho: rola até a seção e o cardápio continua inteiro, do jeito que
   * a pessoa espera de um cardápio de delivery. Este estado é só o destaque.
   */
  const [categoriaVisivel, setCategoriaVisivel] = useState("");
  const fileiraRef = useRef<HTMLDivElement>(null);

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
   * O cardápio inteiro, separado por categoria e com os doces mais bem
   * avaliados na frente de cada seção.
   */
  const secoes = useMemo(
    () => agruparPorCategoria(produtos, ordemDaCamily),
    [produtos, ordemDaCamily]
  );

  /**
   * Acende a categoria da seção que está passando pela tela.
   *
   * A conta é feita na mão, no evento de rolagem, em vez de `IntersectionObserver`:
   * a "linha de leitura" que interessa é uma só (logo abaixo da fileira fixa),
   * e comparar a posição de cada seção com ela é mais direto — e mais fácil de
   * ajustar — do que calibrar `rootMargin` em porcentagem.
   *
   * Vale a ÚLTIMA seção cujo topo já passou da linha: é a que a pessoa está
   * lendo. Antes de qualquer uma chegar lá, a primeira fica acesa, senão a
   * fileira abriria com nada marcado.
   */
  useEffect(() => {
    if (secoes.length === 0) return;

    /** Altura da fileira fixa mais um respiro. */
    const LINHA = 96;

    function aoRolar() {
      let atual = secoes[0]?.categoria ?? "";
      for (const { categoria } of secoes) {
        const el = document.getElementById(idDaSecao(categoria));
        if (!el) continue;
        if (el.getBoundingClientRect().top <= LINHA) atual = categoria;
      }
      setCategoriaVisivel(atual);
    }

    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    window.addEventListener("resize", aoRolar);
    return () => {
      window.removeEventListener("scroll", aoRolar);
      window.removeEventListener("resize", aoRolar);
    };
  }, [secoes]);

  /**
   * Mantém a categoria acesa à vista na fileira.
   *
   * Sem isto, rolar até a última seção acende um chip que ficou escondido lá
   * na direita — a pessoa vê a fileira sem nada marcado e acha que quebrou.
   */
  useEffect(() => {
    const fileira = fileiraRef.current;
    if (!fileira || !categoriaVisivel) return;
    const chip = fileira.querySelector<HTMLElement>(
      `[data-chip="${CSS.escape(categoriaVisivel)}"]`
    );
    if (!chip) return;
    const alvo = chip.offsetLeft - fileira.clientWidth / 2 + chip.offsetWidth / 2;
    fileira.scrollTo({ left: Math.max(0, alvo), behavior: "smooth" });
  }, [categoriaVisivel]);

  /**
   * Toca na categoria e o cardápio rola até ela.
   *
   * Quem cuida da folga pra fileira fixa não cobrir o título é o
   * `scroll-mt-24` da própria seção, não uma conta de pixels aqui — assim a
   * folga acompanha sozinha qualquer mudança na altura da fileira.
   */
  const irPara = useCallback((nome: string) => {
    // Sem `behavior` de propósito: o suave vem do `scroll-behavior` do CSS,
    // que degrada pra rolagem direta onde ele não existe.
    document.getElementById(idDaSecao(nome))?.scrollIntoView({ block: "start" });
  }, []);

  return (
    <>
      <Header />
      <main className="px-4 sm:px-6 md:px-12 pb-16">
        <h1 className="font-display text-2xl sm:text-3xl text-center text-cherryDark">
          Nosso cardápio de hoje
        </h1>
        {/* Onde buscar, como pagar e quem faz — as três perguntas que chegavam
            no WhatsApp antes de qualquer pedido, agora a um toque daqui. */}
        <Link
          href="/loja"
          className="mx-auto mt-2 flex w-fit items-center gap-2 rounded-full bg-white/70 border border-cherryLight/40 px-5 py-2.5 font-body text-sm text-ink/70 hover:border-cherryDark transition-colors"
        >
          <span aria-hidden="true">🍒</span>
          Perfil da loja
        </Link>

        <CherryDivider />
        <BannerPromocao />

        {/*
         * Categorias: grudam no topo enquanto o cardápio rola, e a que está
         * passando pela tela acende sozinha. É o atalho que o dedo procura
         * num cardápio longo — antes elas subiam junto com a página e sumiam
         * no primeiro rolar.
         *
         * As margens negativas levam a fileira até a beirada da tela, pra
         * rolagem lateral começar onde o dedo já está.
         */}
        {categorias.length > 1 && (
          <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 md:-mx-12 px-4 sm:px-6 md:px-12 bg-cream/95 backdrop-blur border-b border-cherryLight/25 mb-5">
            <div
              ref={fileiraRef}
              className="max-w-5xl mx-auto flex gap-2 overflow-x-auto py-2.5"
            >
              {categorias.map((c) => {
                const ativa = categoriaVisivel === c;
                return (
                  <button
                    key={c}
                    data-chip={c}
                    onClick={() => irPara(c)}
                    aria-current={ativa ? "true" : undefined}
                    className={`shrink-0 px-4 py-2.5 rounded-full text-sm font-body border transition-colors ${
                      ativa
                        ? "bg-cherryDark text-white border-cherryDark font-semibold"
                        : "bg-white/70 text-ink/70 border-cherryLight/50 hover:border-cherryDark"
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
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
              <section
                key={nome}
                id={idDaSecao(nome)}
                data-categoria={nome}
                // A folga leva em conta a fileira fixa: sem ela, o atalho para
                // com o título escondido atrás das categorias.
                className="scroll-mt-24"
              >
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
