"use client";

import { useEffect, useState } from "react";
import { getConfiguracaoFrete, salvarConfiguracaoFrete } from "@/lib/api";
import type { ConfiguracaoFrete, FaixaFrete } from "@/lib/types";

export default function AdminFretePage() {
  const [config, setConfig] = useState<ConfiguracaoFrete | null>(null);

  useEffect(() => {
    getConfiguracaoFrete()
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);

  if (!config) return null;

  function atualizarFaixa(id: string, campo: keyof FaixaFrete, valor: number) {
    setConfig((c) =>
      c ? { ...c, faixas: c.faixas.map((f) => (f.id === id ? { ...f, [campo]: valor } : f)) } : c
    );
  }

  function adicionarFaixa() {
    setConfig((c) =>
      c
        ? {
            ...c,
            faixas: [
              ...c.faixas,
              { id: crypto.randomUUID(), distanciaMinKm: 0, distanciaMaxKm: 0, valor: 0 },
            ],
          }
        : c
    );
  }

  function removerFaixa(id: string) {
    setConfig((c) => (c ? { ...c, faixas: c.faixas.filter((f) => f.id !== id) } : c));
  }

  async function salvar() {
    if (!config) return;
    try {
      await salvarConfiguracaoFrete(config);
      alert("Configuração de frete salva!");
    } catch {
      alert("Não foi possível salvar. Tente novamente.");
    }
  }

  return (
    <main className="min-h-screen px-6 md:px-12 py-10 max-w-2xl mx-auto">
      <h1 className="font-display text-3xl text-cherryDark">Configurar frete</h1>
      <p className="text-ink/70 font-body mt-1">
        Origem: {config.origem.endereco}
      </p>

      <div className="grid gap-3 mt-6">
        {config.faixas.map((faixa) => (
          <div key={faixa.id} className="flex items-center gap-2 bg-white/70 border border-cherryLight/30 rounded-xl p-3">
            <span className="text-sm font-body text-ink/60">De</span>
            <input
              type="number"
              step="0.01"
              value={faixa.distanciaMinKm}
              onChange={(e) => atualizarFaixa(faixa.id, "distanciaMinKm", parseFloat(e.target.value) || 0)}
              className="w-20 border border-cherryLight/40 rounded p-1 text-sm"
            />
            <span className="text-sm font-body text-ink/60">km até</span>
            <input
              type="number"
              step="0.01"
              value={faixa.distanciaMaxKm}
              onChange={(e) => atualizarFaixa(faixa.id, "distanciaMaxKm", parseFloat(e.target.value) || 0)}
              className="w-20 border border-cherryLight/40 rounded p-1 text-sm"
            />
            <span className="text-sm font-body text-ink/60">km = R$</span>
            <input
              type="number"
              step="0.01"
              value={faixa.valor}
              onChange={(e) => atualizarFaixa(faixa.id, "valor", parseFloat(e.target.value) || 0)}
              className="w-24 border border-cherryLight/40 rounded p-1 text-sm"
            />
            <button onClick={() => removerFaixa(faixa.id)} className="ml-auto text-red-600 text-sm font-body">
              Remover
            </button>
          </div>
        ))}
      </div>

      <button onClick={adicionarFaixa} className="mt-4 text-sm text-cherryDark underline font-body">
        + Adicionar faixa
      </button>

      <button
        onClick={salvar}
        className="block w-full mt-6 bg-cherryDark text-white rounded-full py-3 font-body font-semibold"
      >
        Salvar configuração de frete
      </button>
    </main>
  );
}
