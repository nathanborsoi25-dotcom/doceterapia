"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Estrelas from "./Estrelas";
import {
  adicionarAoCarrinho,
  EVENTO_CARRINHO,
  getCarrinho,
  salvarCarrinho,
} from "@/lib/store";
import { reais } from "@/lib/formato";
import { fotosDoProduto } from "@/lib/fotos";
import { slugDoProduto } from "@/lib/slug";
import type { Produto } from "@/lib/types";

/**
 * O doce no cardápio.
 *
 * A foto e o nome levam pra página do doce (que abre como gaveta por dentro
 * do site e como página inteira quando o link chega pelo Instagram). Já a
 * parte de baixo é de ação: depois de adicionar, o botão vira contador, pra
 * quem quer três brigadeiros não precisar abrir o carrinho pra isso.
 */
export default function ProductCard({ produto }: { produto: Produto }) {
  const fotos = fotosDoProduto(produto);
  const [foto, setFoto] = useState(0);
  const [quantidade, setQuantidade] = useState(0);

  const esgotado = produto.estoque === 0;
  const limite = produto.estoque ?? 99;
  const poucasUnidades =
    produto.estoque != null && produto.estoque > 0 && produto.estoque <= 3;

  /**
   * O card mostra o que existe no carrinho de verdade — inclusive quando a
   * cliente adiciona pela gaveta do doce ou mexe no carrinho em outra aba.
   * Sem escutar o aviso, o card ficaria dizendo "Adicionar" para um doce que
   * já está lá dentro.
   */
  useEffect(() => {
    const atualizar = () => {
      const noCarrinho = getCarrinho().find((i) => i.produtoId === produto.id);
      setQuantidade(noCarrinho?.quantidade ?? 0);
    };
    atualizar();
    window.addEventListener(EVENTO_CARRINHO, atualizar);
    window.addEventListener("storage", atualizar);
    return () => {
      window.removeEventListener(EVENTO_CARRINHO, atualizar);
      window.removeEventListener("storage", atualizar);
    };
  }, [produto.id]);

  function adicionar() {
    if (esgotado) return;
    adicionarAoCarrinho(produto);
    setQuantidade((q) => q + 1);
  }

  /** Mexe direto no carrinho salvo, pra tela e carrinho nunca divergirem. */
  function mudarQuantidade(nova: number) {
    const itens = getCarrinho()
      .map((i) => (i.produtoId === produto.id ? { ...i, quantidade: nova } : i))
      .filter((i) => i.quantidade > 0);
    salvarCarrinho(itens);
    setQuantidade(nova);
  }

  return (
    /*
     * O arco de cima é a assinatura do card. O `overflow-hidden` fica SÓ na
     * foto: no card inteiro ele recortava o preço e o botão na base.
     */
    <div className="bg-white/70 rounded-t-[999px] rounded-br-3xl rounded-bl-md shadow-sm border border-cherryLight/30 flex flex-col transition-shadow hover:shadow-md">
      <Link
        href={`/doce/${slugDoProduto(produto)}`}
        className="group block"
        aria-label={`Ver ${produto.nome}`}
      >
        <div className="relative aspect-square bg-blush flex items-center justify-center text-5xl overflow-hidden rounded-t-[999px]">
          {fotos.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fotos[foto]}
              alt={produto.nome}
              className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03] ${
                esgotado ? "opacity-40 grayscale" : ""
              }`}
            />
          ) : (
            "🍰"
          )}

          {/* Faixa atravessada de esgotado: tira a dúvida antes de a pessoa
              se animar com o doce e só descobrir no carrinho. */}
          {esgotado && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="w-[140%] -rotate-12 bg-cherryDark/95 text-white text-center font-body font-bold tracking-wide py-2 shadow-lg">
                ESGOTADO
              </span>
            </div>
          )}

          {/* Bolinhas de foto. Trocar a foto NÃO pode abrir o doce, por isso
              o clique é interrompido antes de subir pro link. */}
          {fotos.length > 1 && !esgotado && (
            <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5">
              {fotos.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setFoto(i);
                  }}
                  aria-label={`Ver foto ${i + 1} de ${produto.nome}`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === foto ? "w-5 bg-white" : "w-1.5 bg-white/60"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </Link>

      <div className="p-4 flex flex-col gap-1 flex-1">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/doce/${slugDoProduto(produto)}`} className="min-w-0">
            <h3 className="font-display text-lg text-cherryDark hover:text-cherryMid transition-colors">
              {produto.nome}
            </h3>
          </Link>
          <span
            className={`text-xs px-2 py-1 rounded-full font-body shrink-0 ${
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

        <p className="text-sm text-ink/70 font-body flex-1 line-clamp-3">
          {produto.descricao}
        </p>
        <p className="text-xs text-cherryMid font-body">Sabor: {produto.sabor}</p>

        {poucasUnidades && (
          <p className="text-xs font-body font-semibold text-cherryDark">
            {produto.estoque === 1
              ? "Só resta 1 unidade!"
              : `Só restam ${produto.estoque} unidades!`}
          </p>
        )}

        <Link
          href={`/doce/${slugDoProduto(produto)}`}
          className="text-xs text-cherryDark underline font-body py-2 justify-self-start"
        >
          Ver detalhes{fotos.length > 1 ? ` e ${fotos.length} fotos` : ""}
        </Link>

        <div className="flex items-center justify-between gap-2 mt-1">
          <span className="font-display text-lg text-ink shrink-0">
            {reais(produto.preco)}
          </span>

          {esgotado ? (
            <button
              disabled
              className="text-sm rounded-full px-5 py-3 font-body font-semibold bg-ink/15 text-ink/45 cursor-not-allowed"
            >
              Esgotado
            </button>
          ) : quantidade === 0 ? (
            <button
              onClick={adicionar}
              className="text-sm rounded-full px-5 py-3 font-body font-semibold bg-cherryDark text-white hover:bg-cherryMid active:scale-95 transition-all"
            >
              Adicionar
            </button>
          ) : (
            <div className="flex items-center gap-1 border border-cherryDark/30 rounded-full bg-blush/50">
              <button
                onClick={() => mudarQuantidade(quantidade - 1)}
                aria-label={`Tirar um ${produto.nome}`}
                className="w-11 h-11 rounded-full text-cherryDark text-lg active:scale-90 transition-transform"
              >
                −
              </button>
              <span className="w-6 text-center font-display text-lg tabular-nums text-cherryDark">
                {quantidade}
              </span>
              <button
                onClick={() => mudarQuantidade(quantidade + 1)}
                disabled={quantidade >= limite}
                aria-label={`Adicionar mais um ${produto.nome}`}
                className="w-11 h-11 rounded-full text-cherryDark text-lg active:scale-90 transition-transform disabled:opacity-30"
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
