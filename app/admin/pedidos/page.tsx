"use client";

import { useEffect, useMemo, useState } from "react";
import { atualizarStatusPedido, getPedidos } from "@/lib/api";
import { linkWhatsAppNumero } from "@/lib/contato";
import { situacaoPrazo } from "@/lib/prazo";
import type { PedidoDoPainel, StatusPedido } from "@/lib/types";

const STATUS: { valor: StatusPedido; label: string }[] = [
  { valor: "aguardando_pagamento", label: "Aguardando pagamento" },
  { valor: "pago", label: "Pago" },
  { valor: "em_preparo", label: "Em preparo" },
  { valor: "a_caminho", label: "A caminho" },
  { valor: "concluido", label: "Entregue" },
  { valor: "cancelado", label: "Cancelado" },
];

const PAGAMENTO: Record<PedidoDoPainel["formaPagamento"], string> = {
  pix: "Pix",
  credito: "Crédito",
  debito: "Débito",
};

/** Pedido nestes estados não corre mais contra o prazo. */
const ENCERRADOS: StatusPedido[] = ["concluido", "cancelado"];

export default function AdminPedidosPage() {
  const [pedidos, setPedidos] = useState<PedidoDoPainel[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    getPedidos()
      .then(setPedidos)
      .catch(() => setPedidos([]))
      .finally(() => setCarregando(false));
  }, []);

  async function mudarStatus(id: string, status: StatusPedido) {
    setPedidos((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    await atualizarStatusPedido(id, status);
  }

  function total(p: PedidoDoPainel) {
    const subtotal = p.itens.reduce((a, i) => a + i.precoUnitario * i.quantidade, 0);
    return subtotal + p.valorFrete;
  }

  /**
   * Ordena pelo prazo: o que está vencido ou mais apertado vem primeiro.
   * Pedidos já entregues ou cancelados descem para o fim da lista.
   */
  const ordenados = useMemo(() => {
    return [...pedidos].sort((a, b) => {
      const aFim = ENCERRADOS.includes(a.status);
      const bFim = ENCERRADOS.includes(b.status);
      if (aFim !== bFim) return aFim ? 1 : -1;
      const pa = a.prazoEm ? new Date(a.prazoEm).getTime() : Infinity;
      const pb = b.prazoEm ? new Date(b.prazoEm).getTime() : Infinity;
      return pa - pb;
    });
  }, [pedidos]);

  const vencidos = ordenados.filter(
    (p) =>
      situacaoPrazo(p.prazoEm, { encerrado: ENCERRADOS.includes(p.status) })?.vencido
  ).length;

  return (
    <main className="min-h-screen px-4 sm:px-6 md:px-12 py-8 md:py-10 max-w-3xl mx-auto">
      <h1 className="font-display text-2xl sm:text-3xl text-cherryDark">Meus pedidos</h1>
      <p className="text-sm font-body text-ink/60 mt-1">
        Em ordem de prazo — o mais urgente primeiro.
        {vencidos > 0 && (
          <span className="text-cherryDark font-semibold">
            {" "}
            {vencidos} {vencidos === 1 ? "está vencido" : "estão vencidos"}.
          </span>
        )}
      </p>

      <div className="grid gap-4 mt-6">
        {carregando && <p className="text-ink/60 font-body">Carregando pedidos...</p>}
        {!carregando && ordenados.length === 0 && (
          <p className="text-ink/60 font-body">Ainda não há pedidos.</p>
        )}

        {ordenados.map((p) => {
          const encerrado = ENCERRADOS.includes(p.status);
          const prazo = situacaoPrazo(p.prazoEm, { encerrado });
          const telefone = p.clienteTelefone ?? "";

          return (
            <div
              key={p.id}
              className={`bg-white/70 border rounded-cherry p-3 sm:p-4 grid gap-2 font-body text-sm ${
                prazo?.vencido ? "border-cherryDark border-2" : "border-cherryLight/30"
              }`}
            >
              {/* Prazo em destaque: é a informação que ela olha primeiro */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                {prazo ? (
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      prazo.vencido
                        ? "bg-cherryDark text-white" // vermelho: passou do prazo
                        : encerrado
                          ? "bg-ink/10 text-ink/60" // cinza: pedido já resolvido
                          : prazo.diasRestantes <= 1
                            ? "bg-amber-100 text-amber-800" // amarelo: é hoje/amanhã
                            : "bg-green-100 text-green-800" // verde: tem folga
                    }`}
                  >
                    {prazo.vencido ? `VENCIDO — ${prazo.rotulo}` : `Prazo: ${prazo.rotulo}`}
                  </span>
                ) : (
                  <span className="text-xs text-ink/40">sem prazo definido</span>
                )}
                <span className="font-display text-base text-cherryDark">
                  R$ {total(p).toFixed(2)}
                </span>
              </div>

              {/* Cliente + atalho direto pro WhatsApp dele */}
              <div className="flex flex-wrap items-center gap-2 border-t border-cherryLight/20 pt-2">
                <span className="text-ink/80">
                  {p.clienteNome ?? "Cliente"}
                  {telefone && <span className="text-ink/50"> · {telefone}</span>}
                </span>
                {telefone && (
                  <a
                    href={linkWhatsAppNumero(
                      telefone,
                      `Oi, ${(p.clienteNome ?? "").split(" ")[0]}! Aqui é a Camily, da Doceterapia 🍒`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 bg-[#25D366] text-white rounded-full px-4 py-2.5 text-xs font-semibold hover:brightness-95 transition"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="w-3.5 h-3.5 fill-current">
                      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.02a8.2 8.2 0 0 1-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.37c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.41a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.22-8.24 8.22z" />
                      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.76-1.66-2.06-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.38-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35z" />
                    </svg>
                    WhatsApp
                  </a>
                )}
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
                  ? ` · ${new Date(p.dataAgendada).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`
                  : ""}{" "}
                · {PAGAMENTO[p.formaPagamento]}
                {p.valorFrete > 0 && ` · Frete R$ ${p.valorFrete.toFixed(2)}`}
              </p>

              {p.tipoEntrega === "entrega" && p.enderecoEntrega && (
                <p className="text-ink/60">
                  {p.enderecoEntrega.rua}, {p.enderecoEntrega.numero} —{" "}
                  {p.enderecoEntrega.bairro}, {p.enderecoEntrega.cidade}
                </p>
              )}

              <label className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-ink/60">Situação:</span>
                <select
                  value={p.status}
                  onChange={(e) => mudarStatus(p.id, e.target.value as StatusPedido)}
                  className="border border-cherryLight/40 rounded-lg p-2 bg-white/70"
                >
                  {STATUS.map((s) => (
                    <option key={s.valor} value={s.valor}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-ink/40">
                  pedido feito em {new Date(p.criadoEm).toLocaleDateString("pt-BR")}
                </span>
              </label>
            </div>
          );
        })}
      </div>
    </main>
  );
}
