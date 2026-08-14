"use client";

import { useState } from "react";

/**
 * Reabre a cobrança de um pedido que ficou parado esperando pagamento.
 *
 * Usado nas duas telas de volta do Mercado Pago. Existe pra que "tentar de
 * novo" signifique **retomar o mesmo pedido**, e não recomeçar pelo carrinho:
 * refazer criaria um segundo pedido, e o primeiro ficaria encalhado no painel
 * da Camily parecendo uma venda que ninguém fez.
 *
 * Os valores não são recalculados — a rota reabre a cobrança com o que já está
 * gravado no pedido, então o preço não muda debaixo da cliente.
 */
export default function BotaoPagarPedido({
  pedidoId,
  rotulo = "Concluir meu pagamento",
  className = "",
}: {
  pedidoId: string;
  rotulo?: string;
  className?: string;
}) {
  const [pagando, setPagando] = useState(false);
  const [erro, setErro] = useState("");

  async function pagar() {
    setErro("");
    setPagando(true);
    try {
      const r = await fetch(`/api/cliente/pedidos/${pedidoId}/pagar`, {
        method: "POST",
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
      setPagando(false);
    }
  }

  return (
    <>
      <button
        onClick={pagar}
        disabled={pagando}
        className={
          className ||
          "w-full bg-cherryDark text-white rounded-full px-6 py-3.5 font-body font-semibold hover:bg-cherryMid transition-colors disabled:opacity-50"
        }
      >
        {pagando ? "Abrindo o pagamento..." : rotulo}
      </button>
      {erro && <p className="font-body text-sm text-cherryDark">{erro}</p>}
    </>
  );
}
