"use client";

import { useEffect, useState } from "react";
import CampoNumero from "@/components/CampoNumero";
import VoltarAoPainel from "@/components/VoltarAoPainel";
import { getConfiguracaoFrete, salvarConfiguracaoFrete } from "@/lib/api";
import type { ConfiguracaoFrete, FaixaFrete } from "@/lib/types";

export default function AdminFretePage() {
  const [config, setConfig] = useState<ConfiguracaoFrete | null>(null);
  const [salvando, setSalvando] = useState(false);

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

  function atualizarOrigem(endereco: string) {
    setConfig((c) => (c ? { ...c, origem: { ...c.origem, endereco } } : c));
  }

  async function salvar() {
    if (!config) return;
    setSalvando(true);
    try {
      const resultado = await salvarConfiguracaoFrete(config);
      if (resultado.origem) {
        // Atualiza a tela com as coordenadas encontradas.
        setConfig((c) => (c ? { ...c, origem: resultado.origem! } : c));
      }
      const achou =
        resultado.origem &&
        Number.isFinite(resultado.origem.lat) &&
        Number.isFinite(resultado.origem.lng);
      alert(
        achou
          ? "Configuração de frete salva! Endereço da loja localizado no mapa. ✅"
          : "Configuração salva, mas não consegui localizar o endereço da loja no mapa. Confira se ele está completo (rua, número, cidade)."
      );
    } catch {
      alert("Não foi possível salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <main className="min-h-screen px-4 sm:px-6 md:px-12 py-8 md:py-10 max-w-2xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl sm:text-3xl text-cherryDark">
          Configurar frete
        </h1>
        <VoltarAoPainel />
      </div>

      <label className="grid gap-1 text-sm font-body text-ink/80 mt-4">
        Endereço da loja (ponto de partida do frete)
        <input
          value={config.origem.endereco}
          onChange={(e) => atualizarOrigem(e.target.value)}
          placeholder="Ex: Rua Ajaja, 41 - Arapongas, PR"
          className="border border-cherryLight/60 rounded-xl px-4 py-2 bg-white/70 focus:outline-none focus:ring-2 focus:ring-cherryDark"
        />
        <span className="text-xs text-ink/50">
          Ao salvar, localizamos esse endereço no mapa automaticamente. A
          distância até cada cliente é medida a partir daqui.
        </span>
      </label>

      <div className="grid gap-3 mt-6">
        {config.faixas.map((faixa) => (
          <div
            key={faixa.id}
            className="bg-white/70 border border-cherryLight/30 rounded-xl p-3 flex flex-wrap items-end gap-3"
          >
            {/* Cada campo com seu rótulo em cima: no celular eles quebram
                em linhas sem virar aquela fileira apertada de caixinhas. */}
            <label className="grid gap-1 text-xs font-body text-ink/60">
              De (km)
              <CampoNumero
                valor={faixa.distanciaMinKm}
                onChange={(v) => atualizarFaixa(faixa.id, "distanciaMinKm", v ?? 0)}
                className="w-24 border border-cherryLight/40 rounded-lg p-2 text-sm"
              />
            </label>
            <label className="grid gap-1 text-xs font-body text-ink/60">
              Até (km)
              <CampoNumero
                valor={faixa.distanciaMaxKm}
                onChange={(v) => atualizarFaixa(faixa.id, "distanciaMaxKm", v ?? 0)}
                className="w-24 border border-cherryLight/40 rounded-lg p-2 text-sm"
              />
            </label>
            <label className="grid gap-1 text-xs font-body text-ink/60">
              Frete (R$)
              <CampoNumero
                valor={faixa.valor}
                onChange={(v) => atualizarFaixa(faixa.id, "valor", v ?? 0)}
                className="w-24 border border-cherryLight/40 rounded-lg p-2 text-sm"
              />
            </label>
            <button
              onClick={() => removerFaixa(faixa.id)}
              className="ml-auto text-red-600 text-sm font-body px-3 py-3 rounded-lg hover:bg-red-50"
            >
              Remover
            </button>
          </div>
        ))}
      </div>

      <button onClick={adicionarFaixa} className="mt-4 text-sm text-cherryDark underline font-body py-3 px-1">
        + Adicionar faixa
      </button>

      <button
        onClick={salvar}
        disabled={salvando}
        className="block w-full mt-6 bg-cherryDark text-white rounded-full py-3 font-body font-semibold disabled:opacity-50"
      >
        {salvando ? "Salvando..." : "Salvar configuração de frete"}
      </button>
    </main>
  );
}
