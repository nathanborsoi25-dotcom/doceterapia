"use client";

import { useEffect, useState } from "react";
import PagamentoNoSite from "@/components/PagamentoNoSite";
import { reais } from "@/lib/formato";
import { descontoDoPix, percentualEscrito } from "@/lib/desconto-pix";
import { getClienteLogado } from "@/lib/api";
import type { FormaPagamento } from "@/lib/types";

/** A chave pública do Mercado Pago; vazia = paga pelo Checkout Pro, como antes. */
const CHAVE_MP = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ?? "";

/**
 * Retoma o pagamento de um pedido que ficou parado — e deixa TROCAR a forma.
 *
 * Usado nas telas de volta do Mercado Pago e em "Meus pedidos". Existe pra
 * que "tentar de novo" signifique **retomar o mesmo pedido**, e não recomeçar
 * pelo carrinho: refazer criaria um segundo pedido, e o primeiro ficaria
 * encalhado no painel da Camily parecendo uma venda que ninguém fez.
 *
 * As duas formas aparecem porque quem desistiu no meio muitas vezes desistiu
 * DA FORMA, não da compra — o cartão foi recusado, ou ela preferiu o Pix
 * depois de ver o desconto. Quem escolhe Pix aqui ganha os 4% agora; quem vai
 * pro cartão perde. Quem recalcula esse valor é o servidor.
 */
export default function BotaoPagarPedido({
  pedidoId,
  /**
   * O total do pedido SEM o desconto do Pix — a base da conta.
   *
   * Opcional porque as telas de volta do Mercado Pago só recebem o id do
   * pedido no endereço; ali os botões saem sem valor, o que é melhor do que
   * mostrar um número chutado.
   */
  total,
  /** Quanto o Pix abate, em %. Zero esconde a linha do desconto. */
  percentualPix = 0,
  compacto = false,
}: {
  pedidoId: string;
  total?: number;
  percentualPix?: number;
  compacto?: boolean;
}) {
  const [pagando, setPagando] = useState<FormaPagamento | null>(null);
  const [erro, setErro] = useState("");
  /** Pagando aqui dentro: a forma escolhida e o valor que o servidor calculou. */
  const [aqui, setAqui] = useState<{ forma: "pix" | "credito"; total: number } | null>(null);
  const [pix, setPix] = useState<{ copiaECola: string | null; qrCodeBase64: string | null } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [quem, setQuem] = useState<{ email: string; nome?: string } | null>(null);

  useEffect(() => {
    // O e-mail vem do cadastro: no cartão, o preenchimento automático do
    // celular escreve no campo e o formulário do Mercado Pago não registra.
    if (!CHAVE_MP) return;
    getClienteLogado()
      .then((c) => setQuem(c ? { email: c.email, nome: c.nome } : null))
      .catch(() => setQuem(null));
  }, []);

  const abatimento = total != null ? descontoDoPix("pix", total, percentualPix) : 0;
  const temDesconto = abatimento > 0;

  async function pagar(forma: FormaPagamento) {
    setErro("");
    setPagando(forma);
    try {
      /*
       * Com a chave configurada, a troca de forma acontece SEM sair do site: a
       * rota grava a forma nova no pedido (e refaz o desconto do Pix) e a
       * cobrança abre aqui mesmo.
       */
      if (CHAVE_MP) {
        const r = await fetch(`/api/cliente/pedidos/${pedidoId}/pagar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ formaPagamento: forma, pagarNoSite: true }),
        });

        if (r.status === 401) {
          window.location.assign("/entrar?voltar=%2Fconta");
          return;
        }

        const corpo = await r.json();
        if (!r.ok) {
          setErro(corpo.error ?? "Não consegui abrir o pagamento agora. Tenta de novo?");
          return;
        }

        setAqui({
          forma: forma === "pix" ? "pix" : "credito",
          total: corpo.total ?? total ?? 0,
        });
        return;
      }

      const r = await fetch(`/api/cliente/pedidos/${pedidoId}/pagar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formaPagamento: forma }),
      });

      // A sessão às vezes não volta junto do Mercado Pago (o pagamento
      // acontece dentro do aplicativo dele). Aí o caminho é entrar e seguir
      // por "Meus pedidos", onde o mesmo botão espera por ela.
      if (r.status === 401) {
        window.location.assign("/entrar?voltar=%2Fconta");
        return;
      }

      const corpo = await r.json();
      if (!r.ok || !corpo.url) {
        setErro(corpo.error ?? "Não consegui abrir o pagamento agora. Tenta de novo?");
        return;
      }
      window.location.href = corpo.url;
    } catch {
      setErro("Não consegui abrir o pagamento agora. Confere a internet e tenta de novo?");
    } finally {
      setPagando(null);
    }
  }

  if (pix) {
    return (
      <div className="bg-white/70 border border-cherryLight/50 rounded-2xl p-5 text-center">
        <p className="font-display text-lg text-cherryDark">Pix gerado! 🍒</p>
        {aqui && (
          <p className="font-display text-2xl text-cherryDark mt-1 tabular-nums">
            {reais(aqui.total)}
          </p>
        )}
        {pix.qrCodeBase64 && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={`data:image/png;base64,${pix.qrCodeBase64}`}
            alt="QR code do Pix"
            className="w-52 h-52 mx-auto mt-3 rounded-xl border border-cherryLight/40 bg-white"
          />
        )}
        {pix.copiaECola && (
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(pix.copiaECola ?? "");
              setCopiado(true);
              setTimeout(() => setCopiado(false), 2500);
            }}
            className="mt-3 w-full bg-cherryDark text-white rounded-full px-5 min-h-[44px] font-body font-semibold text-sm hover:bg-cherryMid transition-colors"
          >
            {copiado ? "Copiado! 🍒" : "Copiar código do Pix"}
          </button>
        )}
      </div>
    );
  }

  if (aqui && CHAVE_MP && quem) {
    return (
      <div>
        <PagamentoNoSite
          pedidoId={pedidoId}
          total={aqui.total}
          forma={aqui.forma}
          pagador={quem}
          chavePublica={CHAVE_MP}
          aoConfirmar={(r) => {
            if (r.pix?.copiaECola || r.pix?.qrCodeBase64) {
              setPix(r.pix);
              return;
            }
            window.location.href = `/pedido/sucesso?status=${encodeURIComponent(
              r.situacao
            )}&external_reference=${pedidoId}`;
          }}
        />
        <button
          onClick={() => setAqui(null)}
          className="w-full mt-2 min-h-[44px] font-body text-sm text-cherryDark underline"
        >
          Escolher outra forma de pagamento
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <button
        onClick={() => pagar("pix")}
        disabled={pagando !== null}
        className={`w-full bg-cherryDark text-white rounded-2xl font-body hover:bg-cherryMid transition-colors disabled:opacity-50 text-left ${
          compacto ? "px-4 py-3" : "px-5 py-3.5"
        }`}
      >
        <span className="flex items-center justify-between gap-3">
          <span className="font-semibold">
            {pagando === "pix" ? "Abrindo o Pix..." : "Pagar com Pix"}
          </span>
          {total != null && (
            <span className="font-display tabular-nums">
              {reais(total - abatimento)}
            </span>
          )}
        </span>
        {temDesconto && (
          <span className="flex items-center justify-between gap-3 text-xs text-white/80 mt-0.5">
            <span>
              {percentualEscrito(percentualPix)} de desconto — você economiza{" "}
              {reais(abatimento)}
            </span>
            <span className="line-through tabular-nums">{reais(total ?? 0)}</span>
          </span>
        )}
      </button>

      <button
        onClick={() => pagar("credito")}
        disabled={pagando !== null}
        className={`w-full rounded-2xl font-body transition-colors disabled:opacity-50 text-left bg-white/70 border border-cherryDark/30 text-ink hover:border-cherryDark ${
          compacto ? "px-4 py-3" : "px-5 py-3.5"
        }`}
      >
        <span className="flex items-center justify-between gap-3">
          <span className="font-semibold">
            {pagando === "credito" ? "Abrindo o cartão..." : "Pagar com cartão"}
          </span>
          {total != null && (
            <span className="font-display tabular-nums">{reais(total)}</span>
          )}
        </span>
        <span className="block text-xs mt-0.5 text-ink/55">
          À vista, sem parcelamento.
        </span>
      </button>

      {erro && <p className="font-body text-sm text-cherryDark">{erro}</p>}
    </div>
  );
}
