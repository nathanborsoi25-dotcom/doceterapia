"use client";

import { useEffect, useRef, useState } from "react";
import { reais } from "@/lib/formato";

/**
 * Pagar sem sair do site — o Payment Brick do Mercado Pago.
 *
 * O número do cartão **não passa por aqui**: os campos são iframes do Mercado
 * Pago, e o que o nosso código recebe é um token de uso único. É isso que
 * permite ter a tela de pagamento na Doceterapia sem a loja virar responsável
 * por guardar dado de cartão.
 *
 * ⚠️ O valor mostrado é só informação. Quem decide quanto cobrar é o servidor,
 * a partir do pedido gravado (`lib/total-pedido.ts`) — é a mesma regra que
 * impede alguém de comprar uma torta de R$ 65,00 por R$ 1,00.
 */

type Resultado = {
  situacao: string;
  motivo: string | null;
  pix: { copiaECola: string | null; qrCodeBase64: string | null } | null;
};

declare global {
  interface Window {
    MercadoPago?: new (
      chave: string,
      opcoes?: { locale?: string }
    ) => {
      bricks: () => {
        create: (tipo: string, container: string, opcoes: unknown) => Promise<unknown>;
      };
    };
  }
}

export default function PagamentoNoSite({
  pedidoId,
  total,
  chavePublica,
  aoConfirmar,
}: {
  pedidoId: string;
  total: number;
  chavePublica: string;
  aoConfirmar: (r: Resultado) => void;
}) {
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const jaMontou = useRef(false);

  useEffect(() => {
    // O Brick se desenha uma vez só: em modo estrito o React chama o efeito
    // duas vezes, e sem esta trava apareceriam dois formulários na tela.
    if (jaMontou.current) return;
    jaMontou.current = true;

    async function montar() {
      try {
        // O SDK vem do domínio do Mercado Pago (liberado na CSP do site).
        if (!window.MercadoPago) {
          await new Promise<void>((ok, falhou) => {
            const s = document.createElement("script");
            s.src = "https://sdk.mercadopago.com/js/v2";
            s.onload = () => ok();
            s.onerror = () => falhou(new Error("script"));
            document.head.appendChild(s);
          });
        }

        if (!window.MercadoPago) throw new Error("sdk");

        const mp = new window.MercadoPago(chavePublica, { locale: "pt-BR" });
        await mp.bricks().create("payment", "brick-pagamento", {
          initialization: {
            amount: total,
          },
          customization: {
            paymentMethods: {
              // À vista: a loja não parcela, nem aqui nem no Checkout Pro.
              creditCard: "all",
              bankTransfer: "all",
              maxInstallments: 1,
            },
          },
          callbacks: {
            onReady: () => setCarregando(false),
            onError: (e: { message?: string }) => {
              setErro(e?.message ?? "Algo deu errado no formulário de pagamento.");
              setCarregando(false);
            },
            onSubmit: async ({ formData }: { formData: Record<string, unknown> }) => {
              const metodo =
                formData.payment_method_id === "pix" ? "pix" : "cartao";

              const r = await fetch("/api/pagamento/processar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  pedidoId,
                  metodo,
                  token: formData.token,
                  paymentMethodId: formData.payment_method_id,
                  documento:
                    (formData.payer as { identification?: { number?: string } })
                      ?.identification?.number ?? undefined,
                }),
              });

              const corpo = (await r.json()) as Resultado & {
                error?: string;
                detalhe?: string;
              };

              if (!r.ok) {
                setErro(
                  [corpo.error, corpo.detalhe].filter(Boolean).join(" — ") ||
                    "Não consegui concluir o pagamento."
                );
                throw new Error(corpo.error ?? "recusado");
              }

              aoConfirmar(corpo);
            },
          },
        });
      } catch {
        setErro(
          "Não consegui abrir o pagamento aqui. Use o botão de pagar pelo Mercado Pago."
        );
        setCarregando(false);
      }
    }

    montar();
  }, [chavePublica, pedidoId, total, aoConfirmar]);

  return (
    <div className="mt-4">
      {carregando && (
        <p className="font-body text-sm text-ink/60">Abrindo o pagamento seguro...</p>
      )}

      {erro && (
        <div className="bg-blush/70 border border-cherryDark/40 rounded-2xl p-4 mb-3">
          <p className="font-body text-sm text-cherryDark">{erro}</p>
        </div>
      )}

      {/* É aqui que o Mercado Pago desenha os campos. */}
      <div id="brick-pagamento" />

      <p className="font-body text-xs text-ink/50 mt-3 text-center">
        🔒 Pagamento processado pelo Mercado Pago. O número do cartão não passa
        pela Doceterapia. Total: <strong>{reais(total)}</strong>
      </p>
    </div>
  );
}
