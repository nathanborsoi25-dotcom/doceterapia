"use client";

import { useEffect, useState } from "react";
import { useAdminGuard } from "@/lib/useAdminGuard";
import { atualizarStatusPedido, getPedidos } from "@/lib/api";
import type { Pedido } from "@/lib/types";

const STATUS: { valor: Pedido["status"]; label: string }[] = [
  { valor: "aguardando_pagamento", label: "Aguardando pagamento" },
  { valor: "pago", label: "Pago" },
  { valor: "em_preparo", label: "Em preparo" },
  { valor: "a_caminho", label: "A caminho" },
  { valor: "concluido", label: "Concluído" },
  { valor: "cancelado", label: "Cancelado" },
];

const PAGAMENTO: Record<Pedido["formaPagamento"], string> = {
  pix: "Pix",
  credito: "Crédito",
  debito: "Débito",
};

export default function AdminPedidosPage() {
  useAdminGuard();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    getPedidos()
      .then(setPedidos)
      .catch(() => setPedidos([]))
      .finally(() => setCarregando(false));
  }, []);

  async function mudarStatus(id: string, status: Pedido["status"]) {
    setPedidos((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    await atualizarStatusPedido(id, status);
  }

  function total(p: Pedido) {
    const subtotal = p.itens.reduce((acc, i) => acc + i.precoUnitario * i.quantidade, 0);
    return subtotal + p.valorFrete;
  }

  return (
    <main className="min-h-screen px-6 md:px-12 py-10 max-w-3xl mx-auto">
      <h1 className="font-display text-3xl text-cherryDark">Meus pedidos</h1>

      <div className="grid gap-4 mt-6">
        {carregando && <p className="text-ink/60 font-body">Carregando pedidos...</p>}
        {!carregando && pedidos.length === 0 && (
          <p className="text-ink/60 font-body">Ainda não há pedidos.</p>
        )}
        {pedidos.map((p) => (
          <div
            key={p.id}
            className="bg-white/70 border border-cherryLight/30 rounded-cherry p-4 grid gap-2 font-body text-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-ink/60">
                {new Date(p.criadoEm).toLocaleString("pt-BR")}
              </span>
              <span className="font-display text-base text-cherryDark">
                R$ {total(p).toFixed(2)}
              </span>
            </div>

            <ul className="text-ink/80">
              {p.itens.map((i) => (
                <li key={i.produtoId}>
                  {i.quantidade}× {i.nome} — R$ {i.precoUnitario.toFixed(2)}
                </li>
              ))}
            </ul>

            <p className="text-ink/70">
              {p.tipoEntrega === "entrega" ? "Entrega" : "Retirada"}
              {p.dataAgendada
                ? ` · ${new Date(p.dataAgendada).toLocaleString("pt-BR")}`
                : ""}{" "}
              · {PAGAMENTO[p.formaPagamento]} · Frete R$ {p.valorFrete.toFixed(2)}
            </p>

            {p.tipoEntrega === "entrega" && p.enderecoEntrega && (
              <p className="text-ink/60">
                Endereço: {p.enderecoEntrega.rua}, {p.enderecoEntrega.numero} —{" "}
                {p.enderecoEntrega.bairro}, {p.enderecoEntrega.cidade}
              </p>
            )}

            <label className="flex items-center gap-2 mt-1">
              <span className="text-ink/60">Situação:</span>
              <select
                value={p.status}
                onChange={(e) => mudarStatus(p.id, e.target.value as Pedido["status"])}
                className="border border-cherryLight/40 rounded-lg p-1.5"
              >
                {STATUS.map((s) => (
                  <option key={s.valor} value={s.valor}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ))}
      </div>
    </main>
  );
}
