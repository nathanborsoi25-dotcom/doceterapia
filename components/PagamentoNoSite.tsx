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
  forma,
  pagador,
  chavePublica,
  aoConfirmar,
}: {
  pedidoId: string;
  total: number;
  /**
   * A forma JÁ escolhida lá fora, no botão que a cliente apertou.
   *
   * ⚠️ Não é enfeite: o Brick recebe UM valor só, e Pix e cartão custam
   * diferente por causa do desconto de 4%. Deixar os dois na mesma tela fazia
   * o formulário prometer o preço do Pix para quem escolhesse cartão — e o
   * servidor, que recalcula certo, cobraria outro valor.
   */
  forma: "pix" | "credito";
  /**
   * Quem está pagando, já preenchido do cadastro.
   *
   * ⚠️ Não é só conveniência: no cartão, o preenchimento automático do
   * celular escreve o e-mail no campo e o Brick **não registra a digitação** —
   * a tela mostra o endereço certo e reclama "Dado obrigatório" do mesmo
   * jeito, e o botão de pagar não passa. Mandando o e-mail pronto, o campo
   * nem aparece.
   */
  pagador: { email: string; nome?: string };
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
            // O cadastro já tem esses dados: a cliente não digita de novo.
            payer: {
              email: pagador.email,
              ...(pagador.nome
                ? {
                    firstName: pagador.nome.split(" ")[0],
                    lastName: pagador.nome.split(" ").slice(1).join(" ") || undefined,
                  }
                : {}),
            },
          },
          customization: {
            visual: {
              texts: {
                /*
                 * O Brick escreve "Parcelamento disponível" embaixo do cartão,
                 * e a loja nunca parcelou — prometer isso na tela seria
                 * combinar uma coisa e cobrar outra.
                 */
                paymentMethods: {
                  creditCardValueProp: "Pagamento à vista",
                },
              },
            },
            paymentMethods: {
              /*
               * Só a forma que ela escolheu no botão — o valor que o Brick
               * mostra é o daquela forma, e ter as duas aqui faria a tela
               * prometer o preço do Pix para quem fosse pagar no cartão.
               */
              ...(forma === "pix"
                ? { bankTransfer: "all" as const }
                : { creditCard: "all" as const }),
              /*
               * À vista, e só. A loja nunca parcelou — nem aqui nem no
               * Checkout Pro — e os dois limites vão juntos de propósito: o
               * `min` impede o Brick de abrir em "2x" quando o valor permite.
               *
               * A trava que vale mesmo é a do servidor, que manda
               * `installments: 1` na cobrança. Esta aqui existe pra tela não
               * PROMETER um parcelamento que a cobrança não vai cumprir.
               */
              minInstallments: 1,
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
  }, [chavePublica, pedidoId, total, forma, pagador, aoConfirmar]);

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
        🔒 {forma === "pix" ? "Pix" : "Cartão"} de <strong>{reais(total)}</strong>,
        processado pelo Mercado Pago. O número do cartão não passa pela
        Doceterapia.
      </p>
    </div>
  );
}
