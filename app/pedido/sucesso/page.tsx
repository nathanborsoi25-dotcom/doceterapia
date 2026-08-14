"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import CherryDivider from "@/components/CherryDivider";
import RodapeLinks from "@/components/RodapeLinks";
import BotaoPagarPedido from "@/components/BotaoPagarPedido";
import { limparCarrinho } from "@/lib/store";

/**
 * A volta do Mercado Pago.
 *
 * Esta tela recebe TRÊS situações bem diferentes, e antes tratava as três como
 * se fossem uma só — dizia "Pedido confirmado!" e esvaziava o carrinho sempre:
 *
 *  1. pagou e foi aprovado;
 *  2. pagou e está em análise (o Pix leva alguns instantes);
 *  3. **não pagou** e apertou "voltar para a loja".
 *
 * O caso 3 era o estragado. A pessoa desistia no meio, o site dizia que estava
 * tudo certo e **apagava o carrinho dela** — aí, pra tentar de novo, ela tinha
 * que remontar tudo ou caçar o pedido em "Meus pedidos".
 *
 * Quem conta o que aconteceu é o próprio Mercado Pago, no endereço de volta
 * (`status`/`collection_status`). Sem esse aviso, a regra é a segura: ninguém
 * pagou, então o carrinho fica de pé.
 */

/** O que o Mercado Pago diz que aconteceu. */
type Situacao = "aprovado" | "analisando" | "sem_pagamento";

function lerSituacao(status: string | null): Situacao {
  if (status === "approved") return "aprovado";
  if (status === "pending" || status === "in_process") return "analisando";
  return "sem_pagamento";
}

export default function PedidoSucessoPage() {
  return (
    // `useSearchParams` precisa de Suspense pro Next conseguir montar a casca
    // da página antes de conhecer o endereço.
    <Suspense fallback={null}>
      <Conteudo />
    </Suspense>
  );
}

function Conteudo() {
  const params = useSearchParams();
  const situacao = lerSituacao(
    params.get("status") ?? params.get("collection_status")
  );
  /** Id do pedido, que o Mercado Pago devolve pra gente. */
  const pedidoId = params.get("external_reference") ?? "";

  useEffect(() => {
    // O carrinho só é esvaziado quando existe pagamento de verdade. Quem
    // voltou sem pagar continua com os doces onde estavam.
    if (situacao !== "sem_pagamento") limparCarrinho();
  }, [situacao]);

  const textos = {
    aprovado: {
      emoji: "🍒",
      titulo: "Pagamento confirmado!",
      corpo:
        "Recebemos seu pagamento e a Camily já vai começar a preparar tudo com carinho. Ela combina os detalhes da entrega ou da retirada com você pelo WhatsApp.",
      rodape: "",
    },
    analisando: {
      emoji: "🍒",
      titulo: "Pedido recebido!",
      corpo:
        "Seu pedido está registrado e estamos confirmando o pagamento. Assim que ele cair, a Camily começa a preparar e você recebe um e-mail avisando.",
      rodape: "No Pix a confirmação costuma levar só alguns instantes.",
    },
    sem_pagamento: {
      emoji: "⏳",
      titulo: "Seu pedido está te esperando",
      corpo:
        "Você voltou antes de concluir o pagamento, então ele ainda não foi feito. Seu pedido ficou guardado do jeitinho que estava — é só continuar de onde parou.",
      rodape: "Seus doces continuam no carrinho também.",
    },
  }[situacao];

  const naoPagou = situacao === "sem_pagamento";

  return (
    <>
      <Header />
      <main className="px-4 sm:px-6 md:px-12 pb-16 max-w-xl mx-auto text-center">
        <div className="text-5xl mt-6">{textos.emoji}</div>
        <h1 className="font-display text-2xl sm:text-3xl text-cherryDark mt-4">
          {textos.titulo}
        </h1>
        <CherryDivider />
        <p className="font-body text-ink/80">{textos.corpo}</p>
        {textos.rodape && (
          <p className="font-body text-sm text-ink/60 mt-3">{textos.rodape}</p>
        )}

        {/* Quem não pagou vê primeiro o caminho de concluir — que é o que ela
            veio fazer. O cardápio fica como saída secundária. */}
        {naoPagou ? (
          <div className="grid gap-2 mt-8">
            {pedidoId && <BotaoPagarPedido pedidoId={pedidoId} />}
            <Link
              href="/carrinho"
              className="w-full border border-cherryDark/30 text-ink rounded-full px-6 py-3.5 font-body hover:border-cherryDark transition-colors"
            >
              Ver meu carrinho
            </Link>
            <Link
              href="/catalogo"
              className="font-body text-sm text-ink/60 underline inline-flex items-center justify-center min-h-[44px]"
            >
              Voltar ao cardápio
            </Link>
          </div>
        ) : (
          <div className="grid gap-2 mt-8">
            <Link
              href="/conta"
              className="w-full bg-cherryDark text-white rounded-full px-6 py-3.5 font-body font-semibold hover:bg-cherryMid transition-colors"
            >
              Ver meu pedido
            </Link>
            <Link
              href="/catalogo"
              className="font-body text-sm text-ink/60 underline inline-flex items-center justify-center min-h-[44px]"
            >
              Voltar ao cardápio
            </Link>
          </div>
        )}
      </main>
      <RodapeLinks />
    </>
  );
}
