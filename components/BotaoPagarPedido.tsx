"use client";

import { useState } from "react";
import { reais } from "@/lib/formato";
import { descontoDoPix, percentualEscrito } from "@/lib/desconto-pix";
import type { FormaPagamento } from "@/lib/types";

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

  const abatimento = total != null ? descontoDoPix("pix", total, percentualPix) : 0;
  const temDesconto = abatimento > 0;

  async function pagar(forma: FormaPagamento) {
    setErro("");
    setPagando(forma);
    try {
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
