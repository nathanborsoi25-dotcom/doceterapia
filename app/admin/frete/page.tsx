"use client";

import { useEffect, useState } from "react";
import AvisoSalvo from "@/components/AvisoSalvo";
import CampoNumero from "@/components/CampoNumero";
import VoltarAoPainel from "@/components/VoltarAoPainel";
import { reais } from "@/lib/formato";
import { getConfiguracaoFrete, salvarConfiguracaoFrete } from "@/lib/api";
import { useAvisoSalvo } from "@/lib/usar-aviso-salvo";
import type { ConfiguracaoFrete, FaixaFrete } from "@/lib/types";

export default function AdminFretePage() {
  const [config, setConfig] = useState<ConfiguracaoFrete | null>(null);
  const [salvando, setSalvando] = useState(false);
  const { aviso, avisarSalvo, avisarErro } = useAvisoSalvo();

  useEffect(() => {
    getConfiguracaoFrete()
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);

  /*
   * Enquanto a configuração não chega, a tela dizia `null` — e a Camily
   * ficava uns segundos olhando uma página COMPLETAMENTE em branco, sem saber
   * se tinha quebrado. As outras telas do painel já mostravam "Carregando…".
   */
  if (!config) {
    return (
      <main className="min-h-screen px-4 sm:px-6 md:px-12 py-8 md:py-10 max-w-2xl mx-auto">
        <h1 className="font-display text-2xl sm:text-3xl text-cherryDark">
          Configurar frete
        </h1>
        <p className="font-body text-ink/60 py-10">Carregando as faixas de frete...</p>
      </main>
    );
  }

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

  /**
   * O endereço de fim de semana nasce quando ela começa a digitar e volta a
   * nulo quando ela apaga tudo — vazio é como se desliga a troca.
   */
  function atualizarOrigemFimDeSemana(endereco: string) {
    setConfig((c) =>
      c
        ? {
            ...c,
            origemFimDeSemana: endereco.trim()
              ? { endereco, lat: c.origemFimDeSemana?.lat ?? 0, lng: c.origemFimDeSemana?.lng ?? 0 }
              : null,
          }
        : c
    );
  }

  async function salvar() {
    if (!config) return;
    setSalvando(true);
    try {
      const resultado = await salvarConfiguracaoFrete(config);
      if (!resultado.ok) throw new Error("recusado");

      // Devolve pra tela as coordenadas que o mapa encontrou.
      setConfig((c) =>
        c
          ? {
              ...c,
              origem: resultado.origem ?? c.origem,
              origemFimDeSemana: resultado.origemFimDeSemana ?? null,
            }
          : c
      );

      const localizada = (o?: { lat: number; lng: number } | null) =>
        !!o && Number.isFinite(o.lat) && Number.isFinite(o.lng) && !(o.lat === 0 && o.lng === 0);

      const faltaAchar = [
        localizada(resultado.origem) ? null : "o endereço de segunda a sexta",
        config.origemFimDeSemana && !localizada(resultado.origemFimDeSemana)
          ? "o endereço de fim de semana"
          : null,
      ].filter(Boolean);

      if (faltaAchar.length > 0) {
        avisarErro(
          `Salvei, mas não achei ${faltaAchar.join(" nem ")} no mapa. Confira se tem rua, número e cidade.`
        );
      } else {
        avisarSalvo("Prontinho, o frete está salvo. 🍒");
      }
    } catch {
      avisarErro();
    } finally {
      setSalvando(false);
    }
  }

  const minimoGratis = Number(config.freteGratisAcimaDe) || 0;

  return (
    <main className="min-h-screen px-4 sm:px-6 md:px-12 py-8 md:py-10 max-w-2xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl sm:text-3xl text-cherryDark">
          Configurar frete
        </h1>
        <VoltarAoPainel />
      </div>

      {/* ---------- De onde sai a entrega ---------- */}
      <h2 className="font-display text-lg text-ink mt-6">De onde sai a entrega</h2>

      <label className="grid gap-1 text-sm font-body text-ink/80 mt-2">
        Endereço de segunda a sexta
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

      <label className="grid gap-1 text-sm font-body text-ink/80 mt-4">
        Endereço de sábado e domingo{" "}
        <span className="text-ink/45">(opcional)</span>
        <input
          value={config.origemFimDeSemana?.endereco ?? ""}
          onChange={(e) => atualizarOrigemFimDeSemana(e.target.value)}
          placeholder="Ex: Rua Ariramba Pardo, 597 - Arapongas, PR"
          className="border border-cherryLight/60 rounded-xl px-4 py-2 bg-white/70 focus:outline-none focus:ring-2 focus:ring-cherryDark"
        />
        <span className="text-xs text-ink/50">
          No sábado e no domingo o site calcula o frete a partir deste
          endereço, sozinho. Deixe em branco para sair do mesmo lugar todos os
          dias.
        </span>
      </label>

      {/* ---------- Frete grátis ---------- */}
      <h2 className="font-display text-lg text-ink mt-8">Frete grátis</h2>

      <label className="grid gap-1 text-sm font-body text-ink/80 mt-2">
        Frete grátis em pedidos a partir de (R$)
        <CampoNumero
          valor={config.freteGratisAcimaDe ?? 0}
          onChange={(v) =>
            setConfig((c) => (c ? { ...c, freteGratisAcimaDe: v ?? 0 } : c))
          }
          className="w-36 border border-cherryLight/60 rounded-xl px-4 py-2 bg-white/70 focus:outline-none focus:ring-2 focus:ring-cherryDark"
        />
        <span className="text-xs text-ink/50">
          {minimoGratis > 0 ? (
            <>
              Quem levar <strong>{reais(minimoGratis)}</strong> ou mais em doces
              não paga entrega — e o site mostra pra cliente quanto falta pra
              chegar lá. O valor conta os doces já com o cupom, sem o frete.
            </>
          ) : (
            <>
              Deixe <strong>0</strong> para cobrar entrega em todo pedido. O
              frete do Uber é quase o mesmo em qualquer valor, então esse
              limite é o que faz a cliente somar mais um doce no carrinho.
            </>
          )}
        </span>
      </label>

      {/* ---------- Faixas por distância ---------- */}
      <h2 className="font-display text-lg text-ink mt-8">
        Quanto cobrar por distância
      </h2>

      <div className="grid gap-3 mt-2">
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

      <AvisoSalvo aviso={aviso} />
    </main>
  );
}
