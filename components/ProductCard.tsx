"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Estrelas from "./Estrelas";
import { fotoOtimizada, TAMANHO } from "@/lib/foto-otimizada";
import {
  definirQuantidadeNoCarrinho,
  EVENTO_CARRINHO,
  quantidadeNoCarrinho,
} from "@/lib/store";
import {
  disponibilidadeDoSabor,
  doceEsgotado,
  estoqueDoSabor,
  prazoDoSabor,
  saborEsgotado,
  saboresVisiveis,
} from "@/lib/sabores";
import { reais } from "@/lib/formato";
import { emPromocao, precoAPagar, precoCheio } from "@/lib/promocao";
import { fotosDoProduto } from "@/lib/fotos";
import { slugDoProduto } from "@/lib/slug";
import type { Produto } from "@/lib/types";

/**
 * O doce no cardápio.
 *
 * A foto e o nome levam pra página do doce (que abre como gaveta por dentro
 * do site e como página inteira quando o link chega pelo Instagram). Já a
 * parte de baixo é de ação.
 *
 * O contador NÃO mexe no carrinho enquanto a pessoa escolhe: ela ajusta o
 * número à vontade e só confirma quando estiver decidida. Antes cada toque no
 * "+" já ia direto pro carrinho, então errar a mão significava ver o pedido
 * mudar sozinho e ter que desfazer no dedo. É o mesmo jeito da página do doce.
 */
export default function ProductCard({ produto }: { produto: Produto }) {
  const sabores = saboresVisiveis(produto);
  const fotos = fotosDoProduto(produto);

  /** Qual foto está na frente do trilho — só para mostrar o "2/3". */
  const [foto, setFoto] = useState(0);
  const trilho = useRef<HTMLDivElement>(null);

  /** Quantas unidades já estão no carrinho (só leitura — vem do carrinho). */
  const [noCarrinho, setNoCarrinho] = useState(0);
  /** O contador está aberto? Enquanto estiver, nada foi pro carrinho ainda. */
  const [escolhendo, setEscolhendo] = useState(false);
  /** Número que a pessoa está escolhendo agora, ainda sem valer. */
  const [quantidade, setQuantidade] = useState(1);
  /** Confirmação rápida depois de confirmar, pra ela ver que deu certo. */
  const [confirmado, setConfirmado] = useState(false);

  /**
   * Recheio escolhido. Começa no primeiro que ainda tem — não adianta abrir o
   * card já mostrando o sabor que acabou.
   */
  const [saborId, setSaborId] = useState<string | null>(
    () => (sabores.find((s) => !saborEsgotado(s)) ?? sabores[0])?.id ?? null
  );
  const sabor = sabores.find((s) => s.id === saborId) ?? null;

  // Com recheios, o que manda é o sabor: foto, preço e estoque saem dele.
  // Por isso o trilho de fotos só existe no doce SEM recheios — com eles,
  // trocar de recheio é que troca a foto.
  const fotosDoCard = sabor?.fotoUrl ? [sabor.fotoUrl] : fotos;

  // Com promoção, `preco` é o que ela paga e `precoDeLista` é o riscado.
  const preco = precoAPagar(produto, sabor);
  const precoDeLista = precoCheio(produto, sabor);
  const estaEmPromocao = emPromocao(produto, sabor);
  const estoque = estoqueDoSabor(produto, sabor);
  const disponibilidade = disponibilidadeDoSabor(produto, sabor);
  const prazo = prazoDoSabor(produto, sabor);

  const esgotado = sabor ? saborEsgotado(sabor) : doceEsgotado(produto);
  const limite = estoque ?? 99;
  const poucasUnidades = estoque != null && estoque > 0 && estoque <= 3;

  /**
   * Até onde o "−" desce. Zero só faz sentido para quem JÁ tem o doce no
   * carrinho — é assim que ela tira de lá sem precisar abrir o carrinho. Quem
   * ainda não tem para em 1: zerar não significaria nada.
   */
  const minimo = noCarrinho > 0 ? 0 : 1;

  /**
   * O card mostra o que existe no carrinho de verdade — inclusive quando a
   * cliente adiciona pela gaveta do doce ou mexe no carrinho em outra aba.
   * Sem escutar o aviso, o card ficaria dizendo "Adicionar" para um doce que
   * já está lá dentro.
   */
  useEffect(() => {
    const atualizar = () => setNoCarrinho(quantidadeNoCarrinho(produto.id, saborId));
    atualizar();
    window.addEventListener(EVENTO_CARRINHO, atualizar);
    window.addEventListener("storage", atualizar);
    return () => {
      window.removeEventListener(EVENTO_CARRINHO, atualizar);
      window.removeEventListener("storage", atualizar);
    };
    // Trocar de recheio mostra a quantidade DAQUELE recheio no carrinho.
  }, [produto.id, saborId]);

  /**
   * Trocar de recheio fecha o contador: o número que ela tinha escolhido era
   * do sabor anterior, e levá-lo adiante confirmaria a quantidade no doce
   * errado.
   */
  useEffect(() => {
    setEscolhendo(false);
    setConfirmado(false);
    // O trilho volta pro começo: a foto do recheio anterior não vale mais.
    setFoto(0);
    if (trilho.current) trilho.current.scrollLeft = 0;
  }, [saborId]);

  /**
   * Quem manda na foto é a rolagem, não um estado nosso: o dedo arrasta, o
   * navegador encaixa a próxima foto (scroll-snap) e aqui só acompanhamos pra
   * escrever o "2/3". Antes existiam bolinhas de trocar a foto, mas todo botão
   * ganha 44px de altura mínima em tela de toque (`globals.css`), e elas
   * apareciam esticadas no meio da foto, feito duas barras brancas.
   */
  function acompanharRolagem(e: React.UIEvent<HTMLDivElement>) {
    const largura = e.currentTarget.clientWidth || 1;
    setFoto(Math.round(e.currentTarget.scrollLeft / largura));
  }

  /** Setas do computador, onde não existe dedo pra arrastar. */
  function rolar(direcao: -1 | 1) {
    const el = trilho.current;
    if (el) el.scrollBy({ left: el.clientWidth * direcao, behavior: "smooth" });
  }

  /** Abre o contador já no número que faz sentido continuar de onde parou. */
  function abrirContador() {
    if (esgotado) return;
    setQuantidade(noCarrinho > 0 ? noCarrinho : 1);
    setConfirmado(false);
    setEscolhendo(true);
  }

  /** Só aqui o carrinho muda — é o toque de confirmar. */
  function confirmar() {
    definirQuantidadeNoCarrinho(produto, sabor, quantidade);
    setEscolhendo(false);
    setConfirmado(true);
    setTimeout(() => setConfirmado(false), 2000);
  }

  return (
    /*
     * O arco de cima é a assinatura do card. O `overflow-hidden` fica SÓ na
     * foto: no card inteiro ele recortava o preço e o botão na base.
     */
    <div className="bg-white/70 rounded-t-[999px] rounded-br-3xl rounded-bl-md shadow-sm border border-cherryLight/30 flex flex-col transition-shadow hover:shadow-md">
      {/*
       * As fotos ficam num trilho que rola de lado: no celular e no tablet a
       * cliente arrasta com o dedo e o navegador encaixa a próxima (scroll-snap),
       * do mesmo jeito que ela já conhece do Instagram. Cada foto continua
       * sendo um link pro doce — arrastar não abre nada, porque o navegador
       * cancela o toque quando ele vira rolagem.
       */}
      {/*
       * 4/3 em vez de quadrada: a foto quadrada empurrava o preço e o botão
       * pra baixo da dobra no celular, e a pessoa tinha que rolar um card
       * inteiro pra ver dois doces. O arco continua sendo o mesmo.
       */}
      <div className="group relative aspect-[4/3] bg-blush overflow-hidden rounded-t-[999px]">
        {fotosDoCard.length > 0 ? (
          <div
            ref={trilho}
            onScroll={acompanharRolagem}
            className="flex h-full w-full overflow-x-auto overscroll-x-contain snap-x snap-mandatory"
          >
            {fotosDoCard.map((url, i) => (
              <Link
                key={`${url}-${i}`}
                href={`/doce/${slugDoProduto(produto)}`}
                /*
                 * `scroll={false}` é o que mantém o cardápio parado.
                 *
                 * A gaveta é uma rota paralela: ao abrir, o Next rola até o
                 * conteúdo novo — que fica no FIM do documento. O cardápio
                 * saltava mais de mil pixels, e fechar o doce devolvia a
                 * pessoa num lugar que ela nunca tinha visitado.
                 */
                scroll={false}
                // Só a primeira foto entra na navegação por teclado: são todas
                // o mesmo link, e três paradas por doce cansariam o caminho.
                tabIndex={i > 0 ? -1 : undefined}
                className="block w-full h-full shrink-0 snap-center overflow-hidden"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fotoOtimizada(url, TAMANHO.card)}
                  loading={i === 0 ? "eager" : "lazy"}
                  decoding="async"
                  alt={
                    sabor
                      ? `${produto.nome} — ${sabor.nome}`
                      : fotosDoCard.length > 1
                        ? `${produto.nome} — foto ${i + 1} de ${fotosDoCard.length}`
                        : produto.nome
                  }
                  draggable={false}
                  className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03] ${
                    esgotado ? "opacity-40 grayscale" : ""
                  }`}
                />
              </Link>
            ))}
          </div>
        ) : (
          <Link
            href={`/doce/${slugDoProduto(produto)}`}
                scroll={false}
            aria-label={`Ver ${produto.nome}`}
            className="flex items-center justify-center w-full h-full text-5xl"
          >
            🍰
          </Link>
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

        {fotosDoCard.length > 1 && !esgotado && (
          <>
            {/* Quantas fotos existem e em qual ela está. Sem isso, ninguém
                descobre que dá pra arrastar. Não é clicável de propósito. */}
            <span className="absolute bottom-3 right-3 pointer-events-none rounded-full bg-ink/45 text-white text-[11px] font-body tabular-nums px-2 py-0.5">
              {Math.min(foto + 1, fotosDoCard.length)}/{fotosDoCard.length}
            </span>

            {/* No computador não há dedo pra arrastar, então aparecem setas
                ao passar o mouse. Em tela de toque elas nem existem. */}
            {foto > 0 && (
              <button
                type="button"
                onClick={() => rolar(-1)}
                aria-label={`Foto anterior de ${produto.nome}`}
                className="hidden [@media(pointer:fine)]:flex absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 items-center justify-center rounded-full bg-white/85 text-cherryDark text-lg shadow-sm opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-white transition-opacity"
              >
                ‹
              </button>
            )}
            {foto < fotosDoCard.length - 1 && (
              <button
                type="button"
                onClick={() => rolar(1)}
                aria-label={`Próxima foto de ${produto.nome}`}
                className="hidden [@media(pointer:fine)]:flex absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 items-center justify-center rounded-full bg-white/85 text-cherryDark text-lg shadow-sm opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-white transition-opacity"
              >
                ›
              </button>
            )}
          </>
        )}
      </div>

      <div className="p-4 flex flex-col gap-1 flex-1">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/doce/${slugDoProduto(produto)}`}
            scroll={false}
            className="min-w-0"
          >
            <h3 className="font-display text-lg text-cherryDark hover:text-cherryMid transition-colors">
              {produto.nome}
            </h3>
          </Link>
          {/* A etiqueta segue o recheio escolhido: um pode estar pronto e
              outro precisar de encomenda. */}
          <span
            className={`text-xs px-2 py-1 rounded-full font-body shrink-0 ${
              disponibilidade === "pronta_entrega"
                ? "bg-green-100 text-green-700"
                : "bg-cherryLight/30 text-cherryDark"
            }`}
          >
            {disponibilidade === "pronta_entrega"
              ? "Pronta entrega"
              : `Sob encomenda${prazo ? ` · ${prazo}d` : ""}`}
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

        {/* Recheios: a foto do card troca no toque, sem sair do cardápio.
            Os botões ficam FORA do link, senão escolher o sabor abriria o
            doce em vez de trocar a foto. */}
        {sabores.length > 0 ? (
          <div className="grid gap-1.5">
            <span className="text-xs text-cherryMid font-body">
              {sabor ? `Recheio: ${sabor.nome}` : "Escolha o recheio"}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {sabores.map((s) => {
                const acabou = saborEsgotado(s);
                const escolhido = s.id === saborId;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSaborId(s.id)}
                    disabled={acabou}
                    title={acabou ? `${s.nome} — esgotado` : s.nome}
                    aria-label={`Recheio ${s.nome}${acabou ? " (esgotado)" : ""}`}
                    aria-pressed={escolhido}
                    className={`relative w-11 h-11 rounded-full overflow-hidden border-2 transition-all ${
                      escolhido
                        ? "border-cherryDark scale-105"
                        : "border-cherryLight/40 hover:border-cherryMid"
                    } ${acabou ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    {s.fotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={fotoOtimizada(s.fotoUrl, TAMANHO.miniatura)}
                        loading="lazy"
                        decoding="async"
                        alt=""
                        className={`w-full h-full object-cover ${acabou ? "grayscale" : ""}`}
                      />
                    ) : (
                      <span className="flex items-center justify-center w-full h-full bg-blush text-[10px] font-body text-cherryDark px-0.5 leading-tight">
                        {s.nome.slice(0, 6)}
                      </span>
                    )}
                    {acabou && (
                      <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-cherryDark/80 rotate-[-20deg]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          produto.sabor && (
            <p className="text-xs text-cherryMid font-body">Sabor: {produto.sabor}</p>
          )
        )}

        {poucasUnidades && (
          <p className="text-xs font-body font-semibold text-cherryDark">
            {estoque === 1
              ? `Só resta 1${sabor ? ` de ${sabor.nome}` : ""}!`
              : `Só restam ${estoque}${sabor ? ` de ${sabor.nome}` : ""}!`}
          </p>
        )}

        <Link
          href={`/doce/${slugDoProduto(produto)}`}
                scroll={false}
          className="text-xs text-cherryDark underline font-body inline-flex items-center min-h-[44px] justify-self-start"
        >
          {sabores.length > 1
            ? `Ver detalhes e ${sabores.length} recheios`
            : `Ver detalhes${fotos.length > 1 ? ` e ${fotos.length} fotos` : ""}`}
        </Link>

        <div className="grid gap-2 mt-1">
          <div className="flex items-center justify-between gap-2">
            {/* Em promoção, o preço cheio fica riscado em cima e o novo
                embaixo: é a leitura que a pessoa faz sem precisar comparar. */}
            <span className="shrink-0 grid">
              {estaEmPromocao && (
                <span className="font-body text-xs text-ink/45 line-through leading-none">
                  {reais(precoDeLista)}
                </span>
              )}
              <span
                className={`font-display text-lg leading-tight ${
                  estaEmPromocao ? "text-cherryDark font-bold" : "text-ink"
                }`}
              >
                {reais(preco)}
              </span>
            </span>

            {esgotado ? (
              <button
                disabled
                className="text-sm rounded-full px-5 py-3 font-body font-semibold bg-ink/15 text-ink/45 cursor-not-allowed"
              >
                Esgotado
              </button>
            ) : escolhendo ? (
              /* Escolhendo: o número muda aqui e o carrinho fica intacto. */
              <div className="flex items-center gap-1 border border-cherryDark/30 rounded-full bg-blush/50">
                <button
                  onClick={() => setQuantidade((q) => Math.max(minimo, q - 1))}
                  disabled={quantidade <= minimo}
                  aria-label={`Diminuir a quantidade de ${produto.nome}`}
                  className="w-11 h-11 rounded-full text-cherryDark text-lg active:scale-90 transition-transform disabled:opacity-30"
                >
                  −
                </button>
                <span
                  aria-live="polite"
                  className="w-6 text-center font-display text-lg tabular-nums text-cherryDark"
                >
                  {quantidade}
                </span>
                <button
                  onClick={() => setQuantidade((q) => Math.min(limite, q + 1))}
                  disabled={quantidade >= limite}
                  aria-label={`Aumentar a quantidade de ${produto.nome}`}
                  className="w-11 h-11 rounded-full text-cherryDark text-lg active:scale-90 transition-transform disabled:opacity-30"
                >
                  +
                </button>
              </div>
            ) : confirmado ? (
              <span className="text-sm rounded-full px-5 py-3 font-body font-semibold bg-green-600 text-white">
                No carrinho ✓
              </span>
            ) : noCarrinho > 0 ? (
              /* Já está no carrinho: o toque reabre o contador pra alterar. */
              <button
                onClick={abrirContador}
                aria-label={`Alterar a quantidade de ${produto.nome} no carrinho`}
                className="text-sm rounded-full px-5 py-3 font-body font-semibold bg-blush border border-cherryDark/30 text-cherryDark hover:bg-cherryLight/40 active:scale-95 transition-all"
              >
                {noCarrinho} no carrinho
              </button>
            ) : (
              <button
                onClick={abrirContador}
                className="text-sm rounded-full px-5 py-3 font-body font-semibold bg-cherryDark text-white hover:bg-cherryMid active:scale-95 transition-all"
              >
                Adicionar
              </button>
            )}
          </div>

          {/* O botão de confirmar ocupa a linha inteira: é a ação principal, e
              no celular ele fica longe do "−" e do "+", evitando o toque
              errado bem na hora de decidir. */}
          {escolhendo && (
            <button
              onClick={confirmar}
              className="w-full rounded-full py-3 font-body font-semibold text-sm bg-cherryDark text-white hover:bg-cherryMid active:scale-[0.98] transition-all"
            >
              {quantidade === 0
                ? "Tirar do carrinho"
                : `${noCarrinho > 0 ? "Atualizar" : "Adicionar"} · ${reais(
                    preco * quantidade
                  )}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
