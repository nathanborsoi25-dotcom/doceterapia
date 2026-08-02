"use client";

import { useState } from "react";
import Estrelas from "@/components/Estrelas";
import { adicionarAoCarrinho } from "@/lib/store";
import { reais } from "@/lib/formato";
import { fotosDoProduto } from "@/lib/fotos";
import type { Avaliacao, Produto } from "@/lib/types";

/**
 * O doce por inteiro: fotos grandes, descrição, quantidade e as avaliações de
 * quem já comprou.
 *
 * Serve nas duas portas — a página com endereço próprio (que a Camily manda
 * no story) e a gaveta que sobe por cima do cardápio no celular. Por isso não
 * desenha cabeçalho nem rodapé: quem monta a moldura é quem chama.
 *
 * A galeria (foto grande, setas e miniaturas) veio da estrutura de uma página
 * de produto do 21st.dev, repintada nas cores da casa: aqui a foto aparece
 * INTEIRA, sem corte, que é o ponto de abrir o doce.
 */
export default function DetalheDoce({
  produto,
  avaliacoes,
}: {
  produto: Produto;
  avaliacoes: Avaliacao[];
}) {
  const fotos = fotosDoProduto(produto);
  const [foto, setFoto] = useState(0);
  const [quantidade, setQuantidade] = useState(1);
  const [adicionado, setAdicionado] = useState(false);

  const esgotado = produto.estoque === 0;
  const limite = produto.estoque ?? 99;
  const podeAumentar = !esgotado && quantidade < limite;

  function adicionar() {
    if (esgotado) return;
    for (let i = 0; i < quantidade; i++) adicionarAoCarrinho(produto);
    setAdicionado(true);
    setTimeout(() => setAdicionado(false), 2500);
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-10">
      {/* ---------- Fotos ---------- */}
      <div className="grid gap-3">
        <div className="relative aspect-square rounded-3xl overflow-hidden bg-blush flex items-center justify-center">
          {fotos.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fotos[foto]}
              alt={`${produto.nome} — foto ${foto + 1} de ${fotos.length}`}
              className={`w-full h-full object-contain ${esgotado ? "opacity-40 grayscale" : ""}`}
            />
          ) : (
            <span className="text-6xl">🍰</span>
          )}

          {esgotado && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="w-[140%] -rotate-12 bg-cherryDark/95 text-white text-center font-body font-bold tracking-wide py-2.5 text-lg shadow-lg">
                ESGOTADO
              </span>
            </div>
          )}

          {/* Setas só aparecem quando há mais de uma foto */}
          {fotos.length > 1 && (
            <>
              <button
                onClick={() => setFoto((i) => (i === 0 ? fotos.length - 1 : i - 1))}
                aria-label="Foto anterior"
                className="absolute left-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/85 text-cherryDark text-xl shadow-sm hover:bg-white transition-colors"
              >
                ‹
              </button>
              <button
                onClick={() => setFoto((i) => (i === fotos.length - 1 ? 0 : i + 1))}
                aria-label="Próxima foto"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/85 text-cherryDark text-xl shadow-sm hover:bg-white transition-colors"
              >
                ›
              </button>
            </>
          )}
        </div>

        {fotos.length > 1 && (
          <div className="flex gap-2">
            {fotos.map((url, i) => (
              <button
                key={url}
                onClick={() => setFoto(i)}
                aria-label={`Ver foto ${i + 1}`}
                className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-colors ${
                  i === foto ? "border-cherryDark" : "border-cherryLight/40"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ---------- Informações e compra ---------- */}
      <div className="grid gap-3 content-start">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="font-display text-2xl sm:text-3xl text-cherryDark">
            {produto.nome}
          </h1>
          <span
            className={`text-xs px-3 py-1 rounded-full font-body shrink-0 ${
              produto.disponibilidade === "pronta_entrega"
                ? "bg-green-100 text-green-700"
                : "bg-cherryLight/30 text-cherryDark"
            }`}
          >
            {produto.disponibilidade === "pronta_entrega"
              ? "Pronta entrega"
              : `Sob encomenda${produto.prazoDias ? ` · ${produto.prazoDias} dias` : ""}`}
          </span>
        </div>

        {(produto.totalAvaliacoes ?? 0) > 0 && (
          <div className="flex items-center gap-2">
            <Estrelas nota={produto.notaMedia ?? 0} />
            <span className="text-sm text-ink/60 font-body">
              {(produto.notaMedia ?? 0).toFixed(1).replace(".", ",")} ·{" "}
              {produto.totalAvaliacoes}{" "}
              {produto.totalAvaliacoes === 1 ? "avaliação" : "avaliações"}
            </span>
          </div>
        )}

        <p className="font-body text-ink/75 leading-relaxed">{produto.descricao}</p>
        {produto.sabor && (
          <p className="font-body text-sm text-cherryMid">Sabor: {produto.sabor}</p>
        )}

        {produto.disponibilidade === "sob_encomenda" && produto.prazoDias ? (
          <p className="font-body text-xs text-ink/60 bg-white/70 border border-cherryLight/30 rounded-xl px-3 py-2">
            Este doce é feito sob encomenda: a Camily precisa de{" "}
            {produto.prazoDias} {produto.prazoDias === 1 ? "dia" : "dias"} para
            preparar.
          </p>
        ) : null}

        {produto.estoque != null && produto.estoque > 0 && produto.estoque <= 3 && (
          <p className="font-body text-sm font-semibold text-cherryDark">
            {produto.estoque === 1
              ? "Só resta 1 unidade!"
              : `Só restam ${produto.estoque} unidades!`}
          </p>
        )}

        <p className="font-display text-3xl text-ink mt-1">{reais(produto.preco)}</p>

        {/* Quantidade + adicionar */}
        {esgotado ? (
          <p className="font-body text-sm bg-blush/60 border border-cherryLight/40 rounded-xl px-4 py-3 text-ink/70">
            Esse doce esgotou 😢 Fale com a Camily pelo WhatsApp para saber
            quando volta.
          </p>
        ) : (
          <div className="grid gap-3 mt-1">
            <div className="flex items-center gap-3">
              <div className="flex items-center border border-cherryLight/50 rounded-full bg-white/70">
                <button
                  onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
                  disabled={quantidade <= 1}
                  aria-label="Diminuir quantidade"
                  className="w-11 h-11 rounded-full text-cherryDark text-xl disabled:opacity-30"
                >
                  −
                </button>
                <span className="w-10 text-center font-display text-lg tabular-nums">
                  {quantidade}
                </span>
                <button
                  onClick={() => setQuantidade((q) => q + 1)}
                  disabled={!podeAumentar}
                  aria-label="Aumentar quantidade"
                  className="w-11 h-11 rounded-full text-cherryDark text-xl disabled:opacity-30"
                >
                  +
                </button>
              </div>

              <button
                onClick={adicionar}
                className={`flex-1 rounded-full py-3.5 px-6 font-body font-semibold transition-colors ${
                  adicionado
                    ? "bg-green-600 text-white"
                    : "bg-cherryDark text-white hover:bg-cherryMid"
                }`}
              >
                {adicionado ? "No carrinho ✓" : "Adicionar ao carrinho"}
              </button>
            </div>

            {adicionado && (
              <a
                href="/carrinho"
                className="text-center font-body text-sm text-cherryDark underline py-2"
              >
                Ir para o carrinho
              </a>
            )}
          </div>
        )}
      </div>

      {/* ---------- Avaliações ---------- */}
      <div className="md:col-span-2">
        <h2 className="font-display text-xl text-cherryDark">
          O que as clientes acharam
        </h2>

        {avaliacoes.length === 0 ? (
          <p className="font-body text-sm text-ink/60 mt-2">
            Esse doce ainda não tem avaliação. Quem comprar e receber pode dar a
            nota — e ainda ganha pontos por isso. 🍒
          </p>
        ) : (
          <div className="grid gap-2 mt-3 sm:grid-cols-2">
            {avaliacoes.map((a) => (
              <div
                key={a.id}
                className="bg-white/70 border border-cherryLight/30 rounded-2xl p-3 font-body"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-ink/80 font-semibold">
                    {a.clienteNome}
                  </span>
                  <Estrelas nota={a.nota} tamanho="sm" />
                </div>
                {a.comentario && (
                  <p className="text-sm text-ink/70 mt-1.5">{a.comentario}</p>
                )}
                <p className="text-xs text-ink/40 mt-1.5">
                  {new Date(a.criadoEm).toLocaleDateString("pt-BR")}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
