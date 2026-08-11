"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import VoltarAoPainel from "@/components/VoltarAoPainel";
import { pontosDaLoja, type PontoRetirada } from "@/lib/retirada";

/**
 * Onde a cliente pode buscar o pedido — a Camily edita aqui.
 *
 * Cada endereço tem uma ou mais faixas de horário (uma por linha), porque um
 * lugar pode abrir de manhã e o outro só à noite e no fim de semana. É isso
 * que a cliente lê na hora de escolher a retirada.
 */
export default function AdminRetiradaPage() {
  const [pontos, setPontos] = useState<PontoRetirada[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    fetch("/api/config-loja", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => setPontos(pontosDaLoja(c?.pontosRetirada)))
      .catch(() => setErro("Não consegui carregar os endereços. Tenta recarregar a página?"))
      .finally(() => setCarregando(false));
  }, []);

  function mudarPonto(id: string, mudanca: Partial<PontoRetirada>) {
    setPontos((lista) => lista.map((p) => (p.id === id ? { ...p, ...mudanca } : p)));
    setSalvo(false);
  }

  function adicionar() {
    setPontos((lista) => [
      ...lista,
      { id: crypto.randomUUID(), endereco: "", horarios: [""] },
    ]);
    setSalvo(false);
  }

  function remover(id: string) {
    setPontos((lista) => lista.filter((p) => p.id !== id));
    setSalvo(false);
  }

  const semEndereco = pontos.some((p) => !p.endereco.trim());

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (pontos.length === 0) {
      setErro("Deixe pelo menos um endereço: é onde o cliente vai buscar.");
      return;
    }
    if (semEndereco) {
      setErro("Tem endereço em branco. Preencha ou remova o cartão.");
      return;
    }

    setErro("");
    setSalvando(true);
    try {
      const r = await fetch("/api/config-loja", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pontosRetirada: pontos.map((p) => ({
            ...p,
            endereco: p.endereco.trim(),
            horarios: p.horarios.map((h) => h.trim()).filter(Boolean),
          })),
        }),
      });
      if (!r.ok) throw new Error();
      setSalvo(true);
      setTimeout(() => setSalvo(false), 3000);
    } catch {
      setErro("Não consegui salvar agora. Tenta de novo?");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <main className="min-h-screen px-4 sm:px-6 md:px-12 py-8 md:py-10 max-w-2xl mx-auto">
        <p className="font-body text-ink/60 text-center py-10">Carregando os endereços...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 sm:px-6 md:px-12 py-8 md:py-10 max-w-2xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl sm:text-3xl text-cherryDark">
          Onde o cliente busca
        </h1>
        <VoltarAoPainel />
      </div>
      <p className="font-body text-sm text-ink/60 mt-1">
        Quando o cliente escolhe <strong>Retirada</strong>, ele vê estes
        endereços e escolhe um.{" "}
        <Link
          href="/checkout"
          target="_blank"
          className="text-cherryDark underline inline-flex items-center min-h-[44px] px-1"
        >
          Ver como está no site
        </Link>
      </p>
      <p className="font-body text-xs text-ink/50 mt-2">
        O dia e a hora continuam sendo combinados por você no WhatsApp — aqui é
        só o lugar e os horários em que você atende.
      </p>

      <form onSubmit={salvar} className="grid gap-4 mt-6">
        {pontos.map((ponto, i) => (
          <div
            key={ponto.id}
            className="bg-white/70 border border-cherryLight/30 rounded-2xl p-4 grid gap-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-display text-base text-cherryDark">
                Endereço {i + 1}
              </span>
              <button
                type="button"
                onClick={() => remover(ponto.id)}
                className="font-body text-xs text-ink/50 underline inline-flex items-center min-h-[44px] px-1 hover:text-cherryDark"
              >
                Remover
              </button>
            </div>

            <label className="grid gap-1 text-sm font-body text-ink/80">
              Rua e número
              <input
                value={ponto.endereco}
                onChange={(e) => mudarPonto(ponto.id, { endereco: e.target.value })}
                placeholder="Ex: Rua Ajaja, 41"
                className="w-full border border-cherryLight/60 rounded-xl px-4 py-2.5 bg-white/70 focus:outline-none focus:ring-2 focus:ring-cherryDark"
              />
            </label>

            <label className="grid gap-1 text-sm font-body text-ink/80">
              Horários
              <textarea
                value={ponto.horarios.join("\n")}
                onChange={(e) =>
                  mudarPonto(ponto.id, { horarios: e.target.value.split("\n") })
                }
                rows={3}
                placeholder={"Segunda a sexta, das 9h às 16h30\nSábado, das 9h às 12h"}
                className="w-full border border-cherryLight/60 rounded-xl px-4 py-2.5 bg-white/70 focus:outline-none focus:ring-2 focus:ring-cherryDark resize-y"
              />
              <span className="text-xs text-ink/50">
                Um horário por linha. Escreva do jeito que o cliente entende.
              </span>
            </label>
          </div>
        ))}

        <button
          type="button"
          onClick={adicionar}
          className="border border-cherryDark text-cherryDark rounded-full py-3 font-body font-semibold hover:bg-blush transition-colors"
        >
          + Adicionar outro endereço
        </button>

        {erro && <p className="text-sm text-cherryDark font-body">{erro}</p>}
        {salvo && (
          <p className="text-sm font-body text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
            Prontinho, já está no site. 🍒
          </p>
        )}

        <button
          disabled={salvando}
          className="bg-cherryDark text-white rounded-full py-3 font-body font-semibold hover:bg-cherryMid transition-colors disabled:opacity-50"
        >
          {salvando ? "Salvando..." : "Salvar"}
        </button>

        <p className="text-xs text-ink/45 font-body text-center">
          Mudar um endereço aqui não mexe nos pedidos que já foram feitos: cada
          pedido guarda o endereço que o cliente leu na hora de comprar.
        </p>
      </form>
    </main>
  );
}
