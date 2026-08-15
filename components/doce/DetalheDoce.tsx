"use client";

import { useState } from "react";
import Estrelas from "@/components/Estrelas";
import { adicionarAoCarrinho } from "@/lib/store";
import { reais } from "@/lib/formato";
import { fotosDoProduto } from "@/lib/fotos";
import {
  disponibilidadeDoSabor,
  doceEsgotado,
  estoqueDoSabor,
  prazoDoSabor,
  saborEsgotado,
  saboresVisiveis,
} from "@/lib/sabores";
import { emPromocao, precoAPagar, precoCheio } from "@/lib/promocao";
import { fotoOtimizada, TAMANHO } from "@/lib/foto-otimizada";
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
  const sabores = saboresVisiveis(produto);
  const galeria = fotosDoProduto(produto);
  const [foto, setFoto] = useState(0);
  const [quantidade, setQuantidade] = useState(1);
  const [adicionado, setAdicionado] = useState(false);

  // Começa no primeiro recheio que ainda tem — abrir o doce já no sabor
  // esgotado seria começar pela porta fechada.
  const [saborId, setSaborId] = useState<string | null>(
    () => (sabores.find((s) => !saborEsgotado(s)) ?? sabores[0])?.id ?? null
  );
  const sabor = sabores.find((s) => s.id === saborId) ?? null;

  // Com recheio escolhido, a foto dele manda; sem recheios, vale a galeria.
  const fotos = sabor?.fotoUrl ? [sabor.fotoUrl] : galeria;
  const fotoAtual = fotos[Math.min(foto, fotos.length - 1)];

  const preco = precoAPagar(produto, sabor);
  const precoDeLista = precoCheio(produto, sabor);
  const estaEmPromocao = emPromocao(produto, sabor);
  const estoque = estoqueDoSabor(produto, sabor);
  const disponibilidade = disponibilidadeDoSabor(produto, sabor);
  const prazo = prazoDoSabor(produto, sabor);
  const esgotado = sabor ? saborEsgotado(sabor) : doceEsgotado(produto);
  const limite = estoque ?? 99;
  const podeAumentar = !esgotado && quantidade < limite;

  function escolherSabor(id: string) {
    setSaborId(id);
    setFoto(0);
    setQuantidade(1);
  }

  function adicionar() {
    if (esgotado) return;
    adicionarAoCarrinho(produto, sabor, quantidade);
    setAdicionado(true);
    setTimeout(() => setAdicionado(false), 2500);
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-10">
      {/* ---------- Fotos ---------- */}
      <div className="grid gap-3">
        <div className="relative aspect-square rounded-3xl overflow-hidden bg-blush flex items-center justify-center">
          {fotoAtual ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fotoOtimizada(fotoAtual, TAMANHO.detalhe)}
              decoding="async"
              alt={
                sabor
                  ? `${produto.nome} com recheio de ${sabor.nome}`
                  : `${produto.nome} — foto ${foto + 1} de ${fotos.length}`
              }
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
                <img
                  src={fotoOtimizada(url, TAMANHO.miniatura)}
                  loading="lazy"
                  decoding="async"
                  alt=""
                  className="w-full h-full object-cover"
                />
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
          {/* Segue o recheio escolhido, não o doce. */}
          <span
            className={`text-xs px-3 py-1 rounded-full font-body shrink-0 ${
              disponibilidade === "pronta_entrega"
                ? "bg-green-100 text-green-700"
                : "bg-cherryLight/30 text-cherryDark"
            }`}
          >
            {disponibilidade === "pronta_entrega"
              ? "Pronta entrega"
              : `Sob encomenda${prazo ? ` · ${prazo} ${prazo === 1 ? "dia" : "dias"}` : ""}`}
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

        {/* Recheios: cada um com a própria foto e o próprio preço. */}
        {sabores.length > 0 ? (
          <div className="grid gap-2 mt-1">
            <span className="font-body text-sm text-ink/80">
              Escolha o recheio
              {sabor && <span className="text-cherryMid"> · {sabor.nome}</span>}
            </span>
            <div className="flex flex-wrap gap-2">
              {sabores.map((s) => {
                const acabou = saborEsgotado(s);
                const escolhido = s.id === saborId;
                // O botão do recheio mostra o preço que vale — se aquele
                // recheio está em oferta, é o da oferta.
                const precoDele = precoAPagar(produto, s);
                return (
                  <button
                    key={s.id}
                    onClick={() => escolherSabor(s.id)}
                    disabled={acabou}
                    aria-pressed={escolhido}
                    className={`w-24 rounded-2xl border-2 p-1.5 text-center transition-all ${
                      escolhido
                        ? "border-cherryDark bg-blush/50"
                        : "border-cherryLight/40 hover:border-cherryMid"
                    } ${acabou ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <span className="block w-full aspect-square rounded-xl overflow-hidden bg-blush">
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
                        <span className="flex items-center justify-center w-full h-full text-2xl">
                          🍰
                        </span>
                      )}
                    </span>
                    <span className="block font-body text-xs text-ink/80 mt-1 leading-tight">
                      {s.nome}
                    </span>
                    <span className="block font-body text-[11px] text-cherryMid">
                      {acabou ? "esgotado" : reais(precoDele)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          produto.sabor && (
            <p className="font-body text-sm text-cherryMid">Sabor: {produto.sabor}</p>
          )
        )}

        {disponibilidade === "sob_encomenda" && prazo > 0 ? (
          <p className="font-body text-xs text-ink/60 bg-white/70 border border-cherryLight/30 rounded-xl px-3 py-2">
            {sabor ? `O recheio de ${sabor.nome} é feito` : "Este doce é feito"} sob
            encomenda: a Camily precisa de {prazo} {prazo === 1 ? "dia" : "dias"}{" "}
            para preparar.
          </p>
        ) : disponibilidade === "pronta_entrega" && sabor ? (
          <p className="font-body text-xs text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
            Esse recheio está pronto para entrega. 🍒
          </p>
        ) : null}

        {estoque != null && estoque > 0 && estoque <= 3 && (
          <p className="font-body text-sm font-semibold text-cherryDark">
            {estoque === 1
              ? `Só resta 1${sabor ? ` de ${sabor.nome}` : ""}!`
              : `Só restam ${estoque}${sabor ? ` de ${sabor.nome}` : ""}!`}
          </p>
        )}

        {/* Preço. Em promoção, o cheio riscado vem antes e o selo diz quanto
            ela economiza — o número sozinho não conta essa história. */}
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {estaEmPromocao && (
            <span className="font-body text-base text-ink/45 line-through">
              {reais(precoDeLista)}
            </span>
          )}
          <p
            className={`font-display text-3xl ${
              estaEmPromocao ? "text-cherryDark" : "text-ink"
            }`}
          >
            {reais(preco)}
          </p>
          {estaEmPromocao && (
            <span className="font-body text-xs font-bold bg-cherryDark text-white rounded-full px-3 py-1.5">
              Economize {reais(precoDeLista - preco)}
            </span>
          )}
        </div>

        {estaEmPromocao && (
          <p className="font-body text-xs text-ink/55">
            Doce em promoção não aceita cupom — mas o desconto do Pix continua
            valendo.
          </p>
        )}

        {/* Quantidade + adicionar */}
        {esgotado ? (
          <p className="font-body text-sm bg-blush/60 border border-cherryLight/40 rounded-xl px-4 py-3 text-ink/70">
            {sabor
              ? `O recheio de ${sabor.nome} esgotou 😢 Escolha outro acima ou fale com a Camily pelo WhatsApp.`
              : "Esse doce esgotou 😢 Fale com a Camily pelo WhatsApp para saber quando volta."}
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
          O que os clientes acharam
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
