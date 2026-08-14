"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import CherryDivider from "@/components/CherryDivider";
import RodapeLinks from "@/components/RodapeLinks";
import { reais } from "@/lib/formato";
import { getConfiguracaoFrete, getProdutos } from "@/lib/api";
import { faltaParaFreteGratis, minimoFreteGratis } from "@/lib/shipping";
import { chaveDoItem } from "@/lib/sabores";
import { getCarrinho, salvarCarrinho } from "@/lib/store";
import type { ItemPedido } from "@/lib/types";

export default function CarrinhoPage() {
  const [itens, setItens] = useState<ItemPedido[]>([]);
  /** Estoque de cada doce agora — o carrinho pode ser de ontem. */
  const [estoques, setEstoques] = useState<Map<string, number | null>>(new Map());
  /** Foto de cada doce, pra cliente reconhecer o que comprou de relance. */
  const [fotos, setFotos] = useState<Map<string, string>>(new Map());
  /**
   * A partir de quanto a entrega sai de graça. Zero = a Camily não ligou.
   *
   * Isto vive no carrinho, e não só no checkout, porque é AQUI que a pessoa
   * decide somar mais um doce — no checkout ela já está com o cartão na mão.
   */
  const [minimoGratis, setMinimoGratis] = useState(0);

  useEffect(() => {
    getConfiguracaoFrete()
      .then((c) => setMinimoGratis(minimoFreteGratis(c)))
      .catch(() => setMinimoGratis(0));
  }, []);

  useEffect(() => {
    setItens(getCarrinho());
    getProdutos()
      .then((lista) => {
        // Um mapa só, com a mesma chave usada no carrinho: o doce sozinho e
        // cada recheio dele têm estoque e foto diferentes.
        const porEstoque = new Map<string, number | null>();
        const porFoto = new Map<string, string>();
        for (const p of lista) {
          porEstoque.set(chaveDoItem(p.id), p.estoque ?? null);
          porFoto.set(chaveDoItem(p.id), p.fotoUrl || p.fotos?.[0] || "");
          for (const s of p.sabores ?? []) {
            porEstoque.set(chaveDoItem(p.id, s.id), s.estoque ?? null);
            porFoto.set(chaveDoItem(p.id, s.id), s.fotoUrl || p.fotoUrl || "");
          }
        }
        setEstoques(porEstoque);
        setFotos(porFoto);
      })
      .catch(() => {});
  }, []);

  /**
   * Quantas unidades ainda dá pra levar (null = sem limite). Com recheio, o
   * limite é o do recheio — cada um tem o seu estoque.
   */
  function limite(item: ItemPedido): number | null {
    return estoques.get(chaveDoItem(item.produtoId, item.saborId)) ?? null;
  }

  /** Tira o doce do carrinho de uma vez — com 12 unidades, ninguém vai tocar 12 vezes no "−". */
  function remover(item: ItemPedido) {
    const chave = chaveDoItem(item.produtoId, item.saborId);
    const novos = itens.filter((i) => chaveDoItem(i.produtoId, i.saborId) !== chave);
    setItens(novos);
    salvarCarrinho(novos);
  }

  function atualizarQuantidade(item: ItemPedido, delta: number) {
    const max = limite(item);
    const chave = chaveDoItem(item.produtoId, item.saborId);
    const novos = itens
      .map((i) => {
        if (chaveDoItem(i.produtoId, i.saborId) !== chave) return i;
        const desejada = i.quantidade + delta;
        // Não deixa passar do que existe pra vender: melhor avisar aqui do
        // que na hora de pagar, quando a pessoa já está com o cartão na mão.
        return { ...i, quantidade: max == null ? desejada : Math.min(desejada, max) };
      })
      .filter((i) => i.quantidade > 0);
    setItens(novos);
    salvarCarrinho(novos);
  }

  const total = itens.reduce((acc, i) => acc + i.precoUnitario * i.quantidade, 0);
  /** Quanto as promoções do carrinho já abateram. Zero = nenhuma oferta aqui. */
  const economia = itens.reduce(
    (acc, i) =>
      acc +
      (i.emPromocao && i.precoCheio
        ? Math.max(0, i.precoCheio - i.precoUnitario) * i.quantidade
        : 0),
    0
  );
  /** Algum doce do carrinho esgotou ou não tem quantidade suficiente. */
  const temProblema = itens.some((i) => {
    const max = limite(i);
    return max != null && i.quantidade > max;
  });

  return (
    <>
      <Header />
      <main className="px-4 sm:px-6 md:px-12 pb-16 max-w-2xl mx-auto">
        <h1 className="font-display text-2xl sm:text-3xl text-center text-cherryDark">Seu carrinho</h1>
        <CherryDivider />

        {itens.length === 0 ? (
          <p className="text-center font-body text-ink/70">
            Seu carrinho está vazio.{" "}
            <Link href="/catalogo" className="text-cherryDark underline inline-block py-3 px-1">
              Ver cardápio
            </Link>
          </p>
        ) : (
          <div className="grid gap-4">
            {/*
             * Duas faixas por item — nome em cima, contador embaixo — em vez
             * de tudo numa linha só. Numa tela de 320px o nome do doce e o
             * contador disputavam a mesma linha, e o card inteiro estourava
             * pra fora da tela levando junto o subtotal e o botão de pagar.
             */}
            {itens.map((item) => {
              const chave = chaveDoItem(item.produtoId, item.saborId);
              const foto = fotos.get(chave);
              const max = limite(item);
              const acabou = max === 0;
              const passouDoEstoque = max != null && item.quantidade > max;

              return (
                <div
                  key={chave}
                  className="min-w-0 bg-white/70 rounded-xl px-3 sm:px-4 py-3 border border-cherryLight/30 sm:flex sm:items-center sm:gap-4"
                >
                  <div className="flex items-start gap-3 min-w-0 sm:flex-1">
                    <div className="w-14 h-14 shrink-0 rounded-lg bg-blush overflow-hidden flex items-center justify-center text-xl">
                      {foto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={foto}
                          alt=""
                          className={`w-full h-full object-cover ${acabou ? "opacity-40 grayscale" : ""}`}
                        />
                      ) : (
                        "🍰"
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* Sem truncar: nome de doce cortado no meio não ajuda
                          ninguém a saber o que está comprando. */}
                      <p className="font-display text-ink leading-tight break-words">
                        {item.nome}
                      </p>
                      {item.saborNome && (
                        <p className="text-xs text-cherryMid font-body mt-0.5">
                          Recheio: {item.saborNome}
                        </p>
                      )}
                      {/* Em promoção, o cheio riscado vem junto: a cliente
                          escolheu o doce por causa da oferta, e o carrinho é
                          onde ela confere se a oferta veio mesmo. */}
                      <p className="text-sm text-ink/60 font-body">
                        {item.emPromocao && item.precoCheio ? (
                          <>
                            <span className="line-through text-ink/40">
                              {reais(item.precoCheio)}
                            </span>{" "}
                            <span className="text-cherryDark font-semibold">
                              {reais(item.precoUnitario)}
                            </span>{" "}
                            cada
                          </>
                        ) : (
                          <>{reais(item.precoUnitario)} cada</>
                        )}
                      </p>

                      {(acabou || passouDoEstoque) && (
                        <p className="text-xs font-body font-semibold text-cherryDark mt-1">
                          {acabou
                            ? "Esgotou — tire do carrinho para continuar"
                            : `Restam só ${max} — ajuste a quantidade`}
                        </p>
                      )}

                      {/* No computador o "Remover" fica junto do nome; no
                          celular ele vai pro fim do card, longe do "−". */}
                      <button
                        onClick={() => remover(item)}
                        className="hidden sm:inline-flex text-xs font-body text-ink/50 underline items-center min-h-[44px] hover:text-cherryDark"
                      >
                        Remover
                      </button>
                    </div>
                  </div>

                  {/*
                   * Celular: contador e valor numa faixa embaixo do nome, que
                   * é o que impede o card de estourar em 320px. Da largura de
                   * tablet pra cima eles voltam pra mesma linha do doce, senão
                   * sobra um vão enorme no meio do card.
                   */}
                  <div className="flex items-center justify-between gap-2 mt-3 sm:mt-0 sm:gap-4 sm:shrink-0">
                    {/* Botões de 44px: tamanho confortável para o dedo */}
                    <div className="flex items-center gap-1 font-body shrink-0">
                      <button
                        onClick={() => atualizarQuantidade(item, -1)}
                        aria-label={`Tirar um ${item.nome}`}
                        className="w-11 h-11 rounded-full bg-blush text-cherryDark text-lg flex items-center justify-center active:scale-95 transition-transform"
                      >
                        −
                      </button>
                      <span className="w-8 text-center tabular-nums">{item.quantidade}</span>
                      <button
                        onClick={() => atualizarQuantidade(item, 1)}
                        aria-label={`Adicionar um ${item.nome}`}
                        disabled={max != null && item.quantidade >= max}
                        className="w-11 h-11 rounded-full bg-blush text-cherryDark text-lg flex items-center justify-center active:scale-95 transition-transform disabled:opacity-35 disabled:active:scale-100"
                      >
                        +
                      </button>
                    </div>

                    {/* Quanto esta linha está custando: sem isso a cliente
                        precisava multiplicar de cabeça pra conferir a conta. */}
                    <span className="font-display text-ink tabular-nums sm:w-24 sm:text-right">
                      {reais(item.precoUnitario * item.quantidade)}
                    </span>
                  </div>

                  <button
                    onClick={() => remover(item)}
                    className="sm:hidden text-xs font-body text-ink/50 underline inline-flex items-center min-h-[44px] hover:text-cherryDark"
                  >
                    Remover
                  </button>
                </div>
              );
            })}

            <div className="flex justify-between gap-3 font-display text-lg mt-4">
              <span>Subtotal</span>
              <span className="tabular-nums">{reais(total)}</span>
            </div>
            {economia > 0 && (
              <p className="-mt-3 text-right font-body text-sm text-green-700">
                Você está economizando {reais(economia)} nas promoções 🍒
              </p>
            )}

            {/* O aviso do frete grátis, no lugar onde ainda dá pra somar mais
                um doce. Só aparece quando a Camily ligou a regra. */}
            {minimoGratis > 0 &&
              (total >= minimoGratis ? (
                <p className="flex items-start gap-2.5 font-body text-sm text-green-800 bg-green-50 border border-green-300 rounded-xl px-4 py-3.5">
                  <span aria-hidden className="text-lg leading-none">🎉</span>
                  <span>
                    <strong className="block text-base">
                      Você ganhou frete grátis!
                    </strong>
                    Escolhendo entrega, o frete é por nossa conta. 🍒
                  </span>
                </p>
              ) : (
                <p className="font-body text-sm text-cherryDark bg-blush/60 border border-cherryLight/50 rounded-xl px-4 py-3.5">
                  Faltam{" "}
                  <strong>{reais(faltaParaFreteGratis(total, minimoGratis))}</strong>{" "}
                  pra sua entrega sair de graça.{" "}
                  <Link href="/catalogo" className="underline">
                    Ver mais doces
                  </Link>
                </p>
              ))}

            <p className="text-xs text-ink/50 font-body -mt-2">
              O frete é calculado na próxima etapa, de acordo com a distância
              ou a retirada.
            </p>

            {temProblema ? (
              <p className="mt-2 text-center bg-blush/70 border border-cherryLight/50 rounded-xl py-3 px-4 font-body text-sm text-cherryDark">
                Ajuste os itens marcados acima para seguir para o pagamento.
              </p>
            ) : (
              <Link
                href="/checkout"
                className="mt-2 text-center bg-cherryDark text-white rounded-full py-3 font-body font-semibold hover:bg-cherryMid transition-colors"
              >
                Ir para entrega e pagamento
              </Link>
            )}
          </div>
        )}
      </main>
      <RodapeLinks />
    </>
  );
}
