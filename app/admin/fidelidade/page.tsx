"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CampoNumero from "@/components/CampoNumero";

type Recompensa = {
  id: string;
  nome: string;
  descricao: string;
  pontos: number;
  ativo: boolean;
};

export default function AdminFidelidadePage() {
  const [pontosPorReal, setPontosPorReal] = useState<number | null>(1);
  const [pontosPorAvaliacao, setPontosPorAvaliacao] = useState<number | null>(10);
  const [salvandoRegras, setSalvandoRegras] = useState(false);
  const [recompensas, setRecompensas] = useState<Recompensa[]>([]);
  const [nova, setNova] = useState({ nome: "", descricao: "" });
  const [pontosDoPremio, setPontosDoPremio] = useState<number | null>(null);
  const [criando, setCriando] = useState(false);
  const [aviso, setAviso] = useState("");

  function carregarRecompensas() {
    fetch("/api/recompensas", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setRecompensas)
      .catch(() => setRecompensas([]));
  }

  useEffect(() => {
    fetch("/api/config-loja", { cache: "no-store" })
      .then((r) => r.json())
      .then((c) => {
        setPontosPorReal(Number(c.pontosPorReal ?? 1));
        setPontosPorAvaliacao(Number(c.pontosPorAvaliacao ?? 10));
      })
      .catch(() => {});
    carregarRecompensas();
  }, []);

  async function salvarRegras() {
    setSalvandoRegras(true);
    try {
      const atual = await fetch("/api/config-loja").then((r) => r.json());
      await fetch("/api/config-loja", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...atual,
          pontosPorReal: pontosPorReal ?? 0,
          pontosPorAvaliacao: Math.round(pontosPorAvaliacao ?? 0),
        }),
      });
    } finally {
      setSalvandoRegras(false);
    }
  }

  async function criarRecompensa(e: React.FormEvent) {
    e.preventDefault();
    setAviso("");
    setCriando(true);
    try {
      const res = await fetch("/api/recompensas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...nova, pontos: Math.round(pontosDoPremio ?? 0) }),
      });
      const corpo = await res.json();
      if (!res.ok) {
        setAviso(corpo.error ?? "Não foi possível criar a recompensa.");
        return;
      }
      setNova({ nome: "", descricao: "" });
      setPontosDoPremio(null);
      carregarRecompensas();
    } finally {
      setCriando(false);
    }
  }

  async function remover(id: string) {
    setRecompensas((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/recompensas?id=${id}`, { method: "DELETE" });
  }

  // Exemplo prático, pra ela conferir se a regra ficou do jeito que quer.
  const exemplo = Math.floor(50 * (pontosPorReal ?? 0));

  return (
    <main className="min-h-screen px-4 sm:px-6 md:px-12 py-8 md:py-10 max-w-3xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl sm:text-3xl text-cherryDark">
          Programa de fidelidade
        </h1>
        <Link href="/admin" className="text-sm text-cherryDark underline font-body py-3 px-1">
          Voltar ao painel
        </Link>
      </div>

      <h2 className="font-display text-xl text-cherryDark mt-6">
        Como o cliente ganha pontos
      </h2>

      <div className="bg-white/70 border border-cherryLight/30 rounded-cherry p-4 mt-3 grid gap-3">
        <label className="grid gap-1 text-sm font-body text-ink/80">
          Pontos por real gasto
          <CampoNumero
            valor={pontosPorReal}
            onChange={setPontosPorReal}
            className="w-full border border-cherryLight/50 rounded-xl p-2.5 bg-white/70"
          />
          <span className="text-xs text-ink/50">
            Numa compra de R$ 50,00 o cliente ganharia <strong>{exemplo} pontos</strong>.
          </span>
        </label>

        <label className="grid gap-1 text-sm font-body text-ink/80">
          Pontos por avaliação
          <CampoNumero
            valor={pontosPorAvaliacao}
            onChange={setPontosPorAvaliacao}
            casas={0}
            className="w-full border border-cherryLight/50 rounded-xl p-2.5 bg-white/70"
          />
          <span className="text-xs text-ink/50">
            Quanto o cliente ganha ao avaliar um doce que comprou.
          </span>
        </label>

        <button
          onClick={salvarRegras}
          disabled={salvandoRegras}
          className="bg-cherryDark text-white rounded-full py-3 font-body font-semibold disabled:opacity-50"
        >
          {salvandoRegras ? "Salvando..." : "Salvar regras"}
        </button>
      </div>

      <h2 className="font-display text-xl text-cherryDark mt-8">
        O que o cliente pode resgatar
      </h2>
      <p className="text-sm font-body text-ink/60">
        Cadastre os prêmios e quantos pontos custam.
      </p>

      <form
        onSubmit={criarRecompensa}
        className="bg-white/70 border border-cherryLight/30 rounded-cherry p-4 mt-3 grid gap-3"
      >
        <label className="grid gap-1 text-sm font-body text-ink/80">
          Nome do prêmio *
          <input
            value={nova.nome}
            onChange={(e) => setNova({ ...nova, nome: e.target.value })}
            placeholder="Brigadeiro grátis"
            className="w-full border border-cherryLight/50 rounded-xl p-2.5 bg-white/70"
          />
        </label>
        <label className="grid gap-1 text-sm font-body text-ink/80">
          Descrição
          <input
            value={nova.descricao}
            onChange={(e) => setNova({ ...nova, descricao: e.target.value })}
            placeholder="Um brigadeiro gourmet no seu próximo pedido"
            className="w-full border border-cherryLight/50 rounded-xl p-2.5 bg-white/70"
          />
        </label>
        <label className="grid gap-1 text-sm font-body text-ink/80">
          Custa quantos pontos *
          <CampoNumero
            valor={pontosDoPremio}
            onChange={setPontosDoPremio}
            casas={0}
            placeholder="100"
            className="w-full border border-cherryLight/50 rounded-xl p-2.5 bg-white/70"
          />
        </label>

        {aviso && <p className="text-sm text-cherryDark font-body">{aviso}</p>}

        <button
          disabled={criando}
          className="bg-cherryDark text-white rounded-full py-3 font-body font-semibold disabled:opacity-50"
        >
          {criando ? "Criando..." : "Adicionar prêmio"}
        </button>
      </form>

      <div className="grid gap-2 mt-4">
        {recompensas.length === 0 && (
          <p className="text-ink/60 font-body text-sm">
            Nenhum prêmio cadastrado ainda.
          </p>
        )}
        {recompensas.map((r) => (
          <div
            key={r.id}
            className="bg-white/70 border border-cherryLight/30 rounded-xl p-3 font-body text-sm flex flex-wrap items-center justify-between gap-2"
          >
            <div className="min-w-0">
              <p className="font-display text-base text-cherryDark">{r.nome}</p>
              {r.descricao && <p className="text-ink/60 text-xs">{r.descricao}</p>}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="bg-blush text-cherryDark rounded-full px-3 py-1 text-xs font-semibold">
                {r.pontos} pontos
              </span>
              <button
                onClick={() => remover(r.id)}
                className="text-xs text-red-600 underline py-3 px-1"
              >
                Remover
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
