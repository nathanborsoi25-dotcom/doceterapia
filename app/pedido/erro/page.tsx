"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import CherryDivider from "@/components/CherryDivider";
import RodapeLinks from "@/components/RodapeLinks";
import BotaoPagarPedido from "@/components/BotaoPagarPedido";

/**
 * O pagamento não foi adiante.
 *
 * ⚠️ O "tentar de novo" daqui NÃO volta pro checkout. Voltar pra lá criaria um
 * SEGUNDO pedido, e o primeiro ficaria encalhado em "aguardando pagamento" no
 * painel da Camily, parecendo uma venda que ninguém fez. O Mercado Pago devolve
 * o id do pedido no endereço, então dá pra reabrir a mesma cobrança.
 */
export default function PedidoErroPage() {
  return (
    <Suspense fallback={null}>
      <Conteudo />
    </Suspense>
  );
}

function Conteudo() {
  const params = useSearchParams();
  const pedidoId = params.get("external_reference") ?? "";

  return (
    <>
      <Header />
      <main className="px-4 sm:px-6 md:px-12 pb-16 max-w-xl mx-auto text-center">
        <div className="text-5xl mt-6">😕</div>
        <h1 className="font-display text-2xl sm:text-3xl text-cherryDark mt-4">
          O pagamento não foi concluído
        </h1>
        <CherryDivider />
        <p className="font-body text-ink/80">
          Não se preocupe — nada foi cobrado, e seu pedido continua guardado.
          Você pode tentar de novo, escolher outra forma de pagamento, ou falar
          com a Camily pelo WhatsApp.
        </p>

        <div className="grid gap-2 mt-8">
          {pedidoId ? (
            <BotaoPagarPedido pedidoId={pedidoId} />
          ) : (
            // Sem o id (link antigo ou aberto direto), o caminho é o checkout.
            <Link
              href="/checkout"
              className="w-full bg-cherryDark text-white rounded-full px-6 py-3.5 font-body font-semibold hover:bg-cherryMid transition-colors"
            >
              Tentar de novo
            </Link>
          )}
          <Link
            href="/carrinho"
            className="w-full border border-cherryDark/30 text-ink rounded-full px-6 py-3.5 font-body hover:border-cherryDark transition-colors"
          >
            Ver meu carrinho
          </Link>
          <Link
            href="/conta"
            className="font-body text-sm text-ink/60 underline inline-flex items-center justify-center min-h-[44px]"
          >
            Ver meus pedidos
          </Link>
        </div>
      </main>
      <RodapeLinks />
    </>
  );
}
