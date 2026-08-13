"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import BannerPromocao from "@/components/BannerPromocao";
import ConviteInstalar from "@/components/ConviteInstalar";
import CherryDivider from "@/components/CherryDivider";
import { getCategorias, getProdutos } from "@/lib/api";
import {
  agruparPorCategoria,
  categoriaDoProduto,
  categoriasDe,
  combinaComBusca,
  ordenarPorNota,
} from "@/lib/catalogo";
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

  /**
   * Busca do cardápio.
   *
   * O campo mora no MESMO lugar da fileira de categorias, e um substitui o
   * outro: os dois juntos empilhariam quase 90px de barra grudada no topo,
   * comendo um quinto da tela de um celular justamente enquanto a pessoa
   * tenta ver doce. Durante a busca as categorias não fazem falta — quem
   * digitou "nutella" não quer mais navegar por seção.
   */
  const [busca, setBusca] = useState("");
  const [campoAberto, setCampoAberto] = useState(false);
  const campoRef = useRef<HTMLInputElement>(null);

  const termo = busca.trim();
  /** `null` = ninguém buscou nada; o cardápio inteiro continua na tela. */
  const resultados = useMemo(
    () =>
      termo ? ordenarPorNota(produtos.filter((p) => combinaComBusca(p, termo))) : null,
    [produtos, termo]
  );

  function abrirBusca() {
    setCampoAberto(true);
    // `preventScroll` porque o foco puxaria a página até o campo, e ele já
    // está à vista — a tela daria um salto sem motivo.
    requestAnimationFrame(() => campoRef.current?.focus({ preventScroll: true }));
  }

  function fecharBusca() {
    setBusca("");
    setCampoAberto(false);
  }

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
    // Durante a busca não há seções na tela pra acompanhar.
    if (resultados) return;

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
  }, [secoes, resultados]);

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
        <ConviteInstalar />

        {/*
         * Categorias: grudam no topo enquanto o cardápio rola, e a que está
         * passando pela tela acende sozinha. É o atalho que o dedo procura
         * num cardápio longo — antes elas subiam junto com a página e sumiam
         * no primeiro rolar.
         *
         * As margens negativas levam a fileira até a beirada da tela, pra
         * rolagem lateral começar onde o dedo já está.
         */}
        <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 md:-mx-12 px-4 sm:px-6 md:px-12 bg-cream/95 backdrop-blur border-b border-cherryLight/25 mb-5">
          <div className="max-w-5xl mx-auto flex items-center gap-2 py-2.5">
            {campoAberto ? (
              <>
                <span aria-hidden className="text-cherryMid shrink-0">
                  <IconeLupa />
                </span>
                <input
                  ref={campoRef}
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && fecharBusca()}
                  type="search"
                  enterKeyHint="search"
                  placeholder="Buscar doce, recheio..."
                  aria-label="Buscar no cardápio"
                  className="min-w-0 flex-1 bg-transparent font-body text-ink placeholder:text-ink/40 focus:outline-none"
                />
                <button
                  onClick={fecharBusca}
                  className="shrink-0 font-body text-sm text-cherryDark px-2"
                >
                  Fechar
                </button>
              </>
            ) : (
              <>
                {/* A lupa fica FORA da fileira que rola: buscar não pode
                    depender de a pessoa achar o botão empurrado pro lado. */}
                <button
                  onClick={abrirBusca}
                  aria-label="Buscar no cardápio"
                  className="shrink-0 w-11 h-11 rounded-full bg-white/70 border border-cherryLight/50 text-cherryMid flex items-center justify-center hover:border-cherryDark transition-colors"
                >
                  <IconeLupa />
                </button>

                {categorias.length > 1 && (
                  <div
                    ref={fileiraRef}
                    className="min-w-0 flex-1 flex gap-2 overflow-x-auto"
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
                )}
              </>
            )}
          </div>
        </div>

        {carregando ? (
          <p className="text-center font-body text-ink/60">Carregando cardápio...</p>
        ) : produtos.length === 0 ? (
          <p className="text-center font-body text-ink/60">
            Nenhum doce no cardápio ainda.
          </p>
        ) : resultados ? (
          /* Resultado da busca: uma lista só, sem separar por categoria — quem
             procurou pelo nome quer ver o doce, não em que seção ele mora. */
          <div className="max-w-5xl mx-auto">
            {resultados.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-5xl" aria-hidden>
                  🔍
                </p>
                <p className="font-display text-xl text-cherryDark mt-3">
                  Não achei nenhum doce com “{termo}”
                </p>
                <p className="font-body text-sm text-ink/65 mt-2">
                  Tente outra palavra — ou dê uma olhada no cardápio inteiro,
                  que tem coisa boa esperando. 🍒
                </p>
                <button
                  onClick={fecharBusca}
                  className="mt-4 bg-cherryDark text-white rounded-full px-6 py-3 font-body font-semibold hover:bg-cherryMid transition-colors"
                >
                  Ver o cardápio inteiro
                </button>
              </div>
            ) : (
              <>
                <p className="font-body text-sm text-ink/60 mb-4">
                  {resultados.length}{" "}
                  {resultados.length === 1 ? "doce encontrado" : "doces encontrados"}{" "}
                  para “{termo}”
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {resultados.map((produto) => (
                    <ProductCard key={produto.id} produto={produto} />
                  ))}
                </div>
              </>
            )}
          </div>
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

/**
 * A lupa, feita de geometria simples: um círculo e um risco saindo dele.
 * Ícone pequeno com path escrito à mão é onde já saiu borrão antes (o símbolo
 * do Pix precisou de três tentativas) — aqui não há curva pra errar.
 */
function IconeLupa() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="6.5" />
      <line x1="15.8" y1="15.8" x2="20" y2="20" />
    </svg>
  );
}
