"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import CherryDivider from "@/components/CherryDivider";
import { getCarrinho, getClienteAtual, limparCarrinho } from "@/lib/store";
import { criarPedido, getConfiguracaoFrete } from "@/lib/api";
import { calcularFretePorEndereco } from "@/lib/shipping";
import type { ConfiguracaoFrete, FormaPagamento, TipoEntrega } from "@/lib/types";

export default function CheckoutPage() {
  const router = useRouter();
  const [tipoEntrega, setTipoEntrega] = useState<TipoEntrega>("entrega");
  const [dataAgendada, setDataAgendada] = useState("");
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>("pix");
  const [frete, setFrete] = useState<{ distanciaKm: number; valor: number | null } | null>(null);
  const [config, setConfig] = useState<ConfiguracaoFrete | null>(null);
  const [finalizando, setFinalizando] = useState(false);

  const carrinho = useMemo(() => getCarrinho(), []);
  const cliente = useMemo(() => getClienteAtual(), []);
  const subtotal = carrinho.reduce((acc, i) => acc + i.precoUnitario * i.quantidade, 0);

  useEffect(() => {
    getConfiguracaoFrete()
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);

  useEffect(() => {
    if (tipoEntrega !== "entrega" || !cliente || !config) return;
    // Se o endereço do cliente ainda não tem lat/lng (geocodificação
    // pendente — ver TODO em cadastro/page.tsx), isso cai no fallback.
    if (cliente.endereco.lat && cliente.endereco.lng) {
      setFrete(calcularFretePorEndereco(cliente.endereco.lat, cliente.endereco.lng, config));
    } else {
      setFrete(null);
    }
  }, [tipoEntrega, cliente, config]);

  const valorFrete = tipoEntrega === "retirada" ? 0 : frete?.valor ?? 0;
  const total = subtotal + valorFrete;

  async function handleFinalizar() {
    if (carrinho.length === 0) {
      alert("Seu carrinho está vazio.");
      return;
    }
    setFinalizando(true);
    try {
      // Salva o pedido no banco (status "aguardando_pagamento").
      // TODO (próximo passo): gerar a cobrança real no Mercado Pago
      // (Pix / cartão sem parcelamento). Ver README > "Mercado Pago".
      await criarPedido({
        clienteId: cliente?.id ?? "",
        itens: carrinho,
        tipoEntrega,
        dataAgendada,
        enderecoEntrega: tipoEntrega === "entrega" ? cliente?.endereco : undefined,
        valorFrete,
        formaPagamento,
      });
      limparCarrinho();
      alert(
        "Pedido registrado! 🍒 Ele já aparece no painel da Camily. O pagamento online (Mercado Pago) é o próximo passo que vamos ligar."
      );
      router.push("/catalogo");
    } catch {
      alert("Não foi possível registrar o pedido. Tente novamente.");
      setFinalizando(false);
    }
  }

  return (
    <>
      <Header />
      <main className="px-6 md:px-12 pb-16 max-w-xl mx-auto">
        <h1 className="font-display text-3xl text-center text-cherryDark">
          Entrega e pagamento
        </h1>
        <CherryDivider />

        <section className="grid gap-3">
          <h2 className="font-display text-lg text-ink">Como você quer receber?</h2>
          <div className="flex gap-3">
            <OpcaoBotao
              ativo={tipoEntrega === "entrega"}
              onClick={() => setTipoEntrega("entrega")}
              label="Entrega"
            />
            <OpcaoBotao
              ativo={tipoEntrega === "retirada"}
              onClick={() => setTipoEntrega("retirada")}
              label="Retirada"
            />
          </div>

          {tipoEntrega === "entrega" && (
            <p className="text-sm font-body text-ink/70">
              {frete
                ? frete.valor !== null
                  ? `Distância até você: ${frete.distanciaKm} km — frete: R$ ${frete.valor.toFixed(2)}`
                  : "Endereço fora da nossa área de entrega em Arapongas no momento."
                : "Calculando o frete a partir do seu endereço..."}
            </p>
          )}

          <label className="grid gap-1 text-sm font-body text-ink/80 mt-2">
            {tipoEntrega === "entrega" ? "Data/horário agendado para entrega *" : "Data/horário agendado para retirada *"}
            <input
              type="datetime-local"
              value={dataAgendada}
              onChange={(e) => setDataAgendada(e.target.value)}
              className="border border-cherryLight/60 rounded-xl px-4 py-2 bg-white/70 focus:outline-none focus:ring-2 focus:ring-cherryDark"
            />
          </label>
          <p className="text-xs text-ink/50 -mt-1">
            Se algum item do carrinho é sob encomenda, combine um prazo que
            respeite os dias indicados no cardápio.
          </p>
        </section>

        <CherryDivider />

        <section className="grid gap-3">
          <h2 className="font-display text-lg text-ink">Forma de pagamento</h2>
          <div className="flex gap-3 flex-wrap">
            {(["pix", "credito", "debito"] as FormaPagamento[]).map((forma) => (
              <OpcaoBotao
                key={forma}
                ativo={formaPagamento === forma}
                onClick={() => setFormaPagamento(forma)}
                label={forma === "pix" ? "Pix" : forma === "credito" ? "Crédito à vista" : "Débito"}
              />
            ))}
          </div>
          <p className="text-xs text-ink/50">Não trabalhamos com parcelamento.</p>
        </section>

        <CherryDivider />

        <div className="grid gap-1 font-body">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>R$ {subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Frete</span>
            <span>R$ {valorFrete.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-display text-lg mt-2">
            <span>Total</span>
            <span>R$ {total.toFixed(2)}</span>
          </div>
        </div>

        <button
          onClick={handleFinalizar}
          disabled={!dataAgendada || finalizando}
          className="mt-6 w-full bg-cherryDark text-white rounded-full py-3 font-body font-semibold hover:bg-cherryMid transition-colors disabled:opacity-40"
        >
          {finalizando ? "Registrando pedido..." : "Finalizar pedido"}
        </button>
      </main>
    </>
  );
}

function OpcaoBotao({
  ativo,
  onClick,
  label,
}: {
  ativo: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm font-body border transition-colors ${
        ativo
          ? "bg-cherryDark text-white border-cherryDark"
          : "bg-white/70 text-ink/70 border-cherryLight/50"
      }`}
    >
      {label}
    </button>
  );
}
