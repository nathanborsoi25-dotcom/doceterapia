"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import CherryDivider from "@/components/CherryDivider";
import RodapeLinks from "@/components/RodapeLinks";
import IconeWhatsApp from "@/components/IconeWhatsApp";
import IconeInstagram from "@/components/IconeInstagram";
import { INSTAGRAM_DA_LOJA, linkInstagram } from "@/lib/contato";
import {
  IconeApplePay,
  IconeCartao,
  IconePix,
} from "@/components/IconesPagamento";
import { percentualDoPix, percentualEscrito } from "@/lib/desconto-pix";
import {
  FUNCIONAMENTO_PADRAO,
  horarioEscrito,
  limparFuncionamento,
  lojaAberta,
} from "@/lib/funcionamento";
import {
  avisoDeEntregaHoje,
  ENTREGA_PADRAO,
  horaFalada,
  limparHorarioDeEntrega,
} from "@/lib/entrega-horario";
import { getConfiguracaoFrete } from "@/lib/api";
import { reais } from "@/lib/formato";
import { fotoOtimizada, TAMANHO } from "@/lib/foto-otimizada";
import { minimoFreteGratis } from "@/lib/shipping";
import { pontosDaLoja, type PontoRetirada } from "@/lib/retirada";
import type { ConfiguracaoFrete } from "@/lib/types";
import { useSobre } from "@/lib/usar-sobre";

/**
 * O perfil da loja: quem faz, onde busca e como paga.
 *
 * São as três perguntas que chegavam no WhatsApp antes de qualquer pedido.
 * Estavam espalhadas — a bio no rodapé, os endereços só dentro do checkout e
 * as formas de pagamento em lugar nenhum — então quem estava decidindo se
 * comprava não achava nada disso.
 */

/**
 * As formas que o Mercado Pago oferece, e em qual botão cada uma aparece.
 *
 * Escolhendo Pix, a tela do Mercado Pago mostra **só o Pix**. É o que faz o
 * desconto se pagar: ele só existe porque essa forma custa 0,99% em vez de
 * 4,98%.
 */
const FORMAS = [
  {
    Icone: IconePix,
    nome: "Pix",
    detalhe: "Cai na hora, e o pedido já entra na fila.",
  },
  {
    Icone: IconeCartao,
    nome: "Cartão de crédito",
    detalhe: "À vista, sem parcelamento.",
  },
  {
    Icone: IconeApplePay,
    nome: "Apple Pay",
    detalhe: "No iPhone, escolhendo cartão, com Face ID ou Touch ID.",
  },
];

export default function LojaPage() {
  const { foto, texto, telefone, linkWhatsApp } = useSobre();
  const [pontos, setPontos] = useState<PontoRetirada[]>([]);
  const [percentualPix, setPercentualPix] = useState(0);
  const [funcionamento, setFuncionamento] = useState(FUNCIONAMENTO_PADRAO);
  /** O horário em que a ENTREGA sai — não é o mesmo em que a loja atende. */
  const [entrega, setEntrega] = useState(ENTREGA_PADRAO);
  /** De onde a entrega sai e a partir de quanto ela sai de graça. */
  const [frete, setFrete] = useState<ConfiguracaoFrete | null>(null);

  useEffect(() => {
    fetch("/api/config-loja", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => {
        setPontos(pontosDaLoja(c?.pontosRetirada));
        setPercentualPix(percentualDoPix(c?.descontoPix));
        setFuncionamento(limparFuncionamento(c?.funcionamento));
        setEntrega(limparHorarioDeEntrega(c?.entrega));
      })
      .catch(() => setPontos(pontosDaLoja(null)));

    getConfiguracaoFrete()
      .then(setFrete)
      .catch(() => setFrete(null));
  }, []);

  const aberta = lojaAberta(funcionamento);
  const avisoDeHoje = avisoDeEntregaHoje(entrega);
  const minimoGratis = frete ? minimoFreteGratis(frete) : 0;
  /** A Camily cadastrou um endereço próprio pro fim de semana? */
  const origemFimDeSemana = frete?.origemFimDeSemana?.endereco?.trim() || "";

  return (
    <>
      <Header />
      <main className="px-4 sm:px-6 md:px-12 pb-16 max-w-2xl mx-auto">
        {/* ---------- Quem faz ---------- */}
        <section className="text-center">
          <div className="w-28 h-28 rounded-full mx-auto bg-cherryLight/40 overflow-hidden flex items-center justify-center text-4xl">
            {foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
              src={fotoOtimizada(foto, TAMANHO.rodape)}
              alt="Camily Vilasboa"
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
            ) : (
              "🍒"
            )}
          </div>
          <h1 className="font-display text-2xl sm:text-3xl text-cherryDark mt-3">
            Camily Vilasboa
          </h1>
          <p className="font-body text-sm text-ink/70 mt-2 whitespace-pre-line">
            {texto}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <a
              href={linkWhatsApp("Oi, Camily! Vi o site da Doceterapia e queria tirar uma dúvida.")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#25D366] text-white rounded-full px-5 py-3 font-body font-semibold text-sm hover:brightness-95 transition"
            >
              <IconeWhatsApp className="w-4 h-4" />
              {telefone}
            </a>

            {/*
              O gradiente do Instagram vem do CSS do botão, não de um `defs`
              dentro do SVG: dois ícones iguais na mesma tela colidiriam pelo
              id do gradiente, e o segundo sairia sem cor.
            */}
            <a
              href={linkInstagram()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full px-5 py-3 font-body font-semibold text-sm text-white bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] hover:brightness-95 transition"
            >
              <IconeInstagram className="w-4 h-4" />@{INSTAGRAM_DA_LOJA}
            </a>
          </div>
        </section>

        <CherryDivider />

        {/* ---------- Quando a loja atende ---------- */}
        <section>
          <h2 className="font-display text-xl text-cherryDark">
            Horário de funcionamento
          </h2>
          <div
            className={`mt-3 rounded-2xl border px-4 py-3 font-body text-sm ${
              aberta
                ? "bg-green-50 border-green-200 text-green-900"
                : "bg-blush/60 border-cherryLight/50 text-ink/75"
            }`}
          >
            <p className="font-semibold">
              {aberta ? "🟢 Aberta agora" : "🌙 Fechada agora"}
            </p>
            <p className="mt-0.5">{horarioEscrito(funcionamento)}</p>
            {!aberta && (
              <p className="text-xs mt-1.5">
                Você pode montar o carrinho a qualquer hora — só o fechamento do
                pedido espera a loja abrir.
              </p>
            )}
          </div>
        </section>

        <CherryDivider />

        {/* ---------- Onde buscar ---------- */}
        <section>
          <h2 className="font-display text-xl text-cherryDark">Onde buscar</h2>
          <p className="font-body text-sm text-ink/60 mt-1">
            Escolhendo <strong>Retirada</strong> no pedido, você busca num
            destes endereços. O dia e a hora você combina com a Camily.
          </p>

          <div className="grid gap-3 mt-3">
            {pontos.map((p) => (
              <div
                key={p.id}
                className="bg-white/70 border border-cherryLight/30 rounded-2xl p-4 font-body text-sm"
              >
                {/* Cereja no lugar do pin: é o símbolo da casa, o mesmo da
                    logo e do divisor, e diz "aqui" com a cara da loja. */}
                <p className="font-display text-base text-cherryDark">
                  <span aria-hidden="true">🍒</span> {p.endereco}
                </p>
                <ul className="text-ink/70 mt-1.5 grid gap-0.5">
                  {p.horarios.filter(Boolean).map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
                {/*
                 * Abre o app de mapas do celular com o endereço já procurado.
                 * Um mapa embutido pediria chave de API do Google e deixaria a
                 * tela pesada — e no celular o app nativo é melhor de usar do
                 * que um mapinha dentro do site.
                 */}
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `${p.endereco}, Arapongas, PR`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-cherryDark font-semibold underline min-h-[44px]"
                >
                  Ver no mapa
                </a>
              </div>
            ))}
          </div>

          {/*
           * A entrega: quando sai, de onde sai e quanto custa.
           *
           * O horário fica AQUI, e não junto do "horário de funcionamento" lá
           * em cima, porque são duas coisas diferentes que já confundiram: a
           * loja aceita pedido até as 22h, mas a Camily só entrega até as
           * 16h30 nos dias de semana.
           */}
          <div className="font-body text-xs text-ink/60 bg-blush/40 border border-cherryLight/30 rounded-xl px-3 py-3 mt-3 grid gap-2">
            <p>
              🛵 <strong className="text-ink/80">Horário de entrega:</strong>{" "}
              segunda a sexta, das {horaFalada(entrega.semana.abre)} às{" "}
              {horaFalada(entrega.semana.fecha)}. Sábado e domingo, das{" "}
              {horaFalada(entrega.fimDeSemana.abre)} às{" "}
              {horaFalada(entrega.fimDeSemana.fecha)}.
            </p>

            {avisoDeHoje && (
              <p className="text-cherryDark font-semibold">{avisoDeHoje}</p>
            )}

            <p>
              📍 <strong className="text-ink/80">De onde sai:</strong>{" "}
              {origemFimDeSemana ? (
                <>
                  de segunda a sexta, da{" "}
                  <strong>{frete?.origem.endereco}</strong>; no sábado e no
                  domingo, da <strong>{origemFimDeSemana}</strong>. O frete é
                  calculado pela distância até o seu endereço, então ele pode
                  mudar conforme o dia.
                </>
              ) : (
                <>
                  da <strong>{frete?.origem.endereco ?? "Rua Ajaja, 41"}</strong>
                  , e o valor do frete é calculado pela distância até o seu
                  endereço.
                </>
              )}{" "}
              Entregamos só em Arapongas-PR.
            </p>

            {minimoGratis > 0 && (
              <p className="text-green-700 font-semibold">
                🎉 Frete grátis nos pedidos a partir de {reais(minimoGratis)} em
                doces.
              </p>
            )}
          </div>
        </section>

        <CherryDivider />

        {/* ---------- Como pagar ---------- */}
        <section>
          <h2 className="font-display text-xl text-cherryDark">Como pagar</h2>
          <p className="font-body text-sm text-ink/60 mt-1">
            O pagamento acontece <strong>dentro do Mercado Pago</strong>. A
            Doceterapia não vê nem guarda os dados do seu cartão.
          </p>

          <div className="grid gap-2 mt-3">
            {FORMAS.map(({ Icone, nome, detalhe }) => (
              <div
                key={nome}
                className="flex items-center gap-3 bg-white/70 border border-cherryLight/30 rounded-xl px-4 py-3 font-body text-sm"
              >
                <Icone className="w-9 h-7 shrink-0 text-ink/80" />
                <span className="min-w-0">
                  <span className="block text-ink/85 font-semibold">{nome}</span>
                  <span className="block text-xs text-ink/55">{detalhe}</span>
                </span>
              </div>
            ))}
          </div>

          {percentualPix > 0 && (
            <p className="font-body text-sm text-green-800 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mt-3">
              💸 Pagando no <strong>Pix</strong> você ganha{" "}
              <strong>{percentualEscrito(percentualPix)} de desconto</strong>,
              sem cupom nenhum.
            </p>
          )}

          <div className="flex items-start gap-3 bg-white/60 border border-cherryLight/30 rounded-xl px-4 py-3 mt-3 font-body text-xs text-ink/60">
            <span className="text-lg leading-none shrink-0" aria-hidden="true">
              🔒
            </span>
            <span>
              <strong className="text-ink/80">100% seguro.</strong> Você é levado
              ao ambiente do Mercado Pago para pagar, o mesmo de qualquer loja
              que usa a plataforma. Nenhum dado de pagamento passa por aqui.
            </span>
          </div>
        </section>

        <div className="mt-8 grid gap-2">
          <Link
            href="/catalogo"
            className="bg-cherryDark text-white rounded-full py-3 font-body font-semibold text-center hover:bg-cherryMid transition-colors"
          >
            Ver o cardápio
          </Link>
          <Link
            href="/politica"
            className="text-center font-body text-sm text-cherryDark underline min-h-[44px] inline-flex items-center justify-center"
          >
            Cancelamento e reembolso
          </Link>
        </div>
      </main>
      <RodapeLinks />
    </>
  );
}
