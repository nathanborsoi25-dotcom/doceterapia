"use client";

import { useEffect, useState } from "react";
import VoltarAoPainel from "@/components/VoltarAoPainel";
import {
  criarCategoria,
  getCategorias,
  removerCategoria,
  renomearCategoria,
  reordenarCategorias,
  type CategoriaDoPainel,
} from "@/lib/api";

/**
 * Categorias do cardápio.
 *
 * A ordem daqui é a ordem em que as seções aparecem para a cliente — por isso
 * as setas: a Camily pode botar "Tortas" na frente de "Docinhos" se for isso
 * que ela mais vende.
 */
export default function AdminCategoriasPage() {
  const [lista, setLista] = useState<CategoriaDoPainel[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [nova, setNova] = useState("");
  const [criando, setCriando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [nomeEditado, setNomeEditado] = useState("");

  function carregar() {
    getCategorias()
      .then(setLista)
      .catch(() => setLista([]))
      .finally(() => setCarregando(false));
  }

  useEffect(carregar, []);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!nova.trim()) return;
    setAviso("");
    setCriando(true);
    try {
      await criarCategoria(nova);
      setNova("");
      carregar();
    } catch (erro) {
      setAviso(erro instanceof Error ? erro.message : "Não foi possível criar.");
    } finally {
      setCriando(false);
    }
  }

  async function salvarNome(id: string) {
    setAviso("");
    try {
      await renomearCategoria(id, nomeEditado);
      setEditando(null);
      carregar();
    } catch (erro) {
      setAviso(erro instanceof Error ? erro.message : "Não foi possível renomear.");
    }
  }

  async function remover(categoria: CategoriaDoPainel) {
    const certeza = window.confirm(
      categoria.doces > 0
        ? `Remover "${categoria.nome}"? Os ${categoria.doces} doce(s) dela continuam no cardápio, mas passam a aparecer em "Outros doces".`
        : `Remover a categoria "${categoria.nome}"?`
    );
    if (!certeza) return;
    await removerCategoria(categoria.id);
    carregar();
  }

  async function mover(id: string, direcao: -1 | 1) {
    const i = lista.findIndex((c) => c.id === id);
    const j = i + direcao;
    if (i < 0 || j < 0 || j >= lista.length) return;

    const novas = [...lista];
    [novas[i], novas[j]] = [novas[j], novas[i]];
    setLista(novas); // mexe na tela na hora; o servidor confirma em seguida
    await reordenarCategorias(novas.map((c, ordem) => ({ id: c.id, ordem })));
  }

  return (
    <main className="min-h-screen px-4 sm:px-6 md:px-12 py-8 md:py-10 max-w-2xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl sm:text-3xl text-cherryDark">Categorias</h1>
        <VoltarAoPainel />
      </div>
      <p className="text-sm font-body text-ink/60 mt-1">
        É por elas que o cardápio se organiza. A ordem aqui é a ordem que a
        cliente vê — arraste as mais vendidas para cima com as setas.
      </p>

      <form
        onSubmit={adicionar}
        className="bg-white/70 border border-cherryLight/30 rounded-2xl p-4 mt-5 grid gap-2"
      >
        <label className="grid gap-1 text-sm font-body text-ink/80">
          Nova categoria
          <div className="flex flex-wrap gap-2">
            <input
              value={nova}
              onChange={(e) => setNova(e.target.value)}
              placeholder="Ex: Tortas, Bolos, Docinhos de festa"
              className="flex-1 min-w-0 border border-cherryLight/50 rounded-xl px-4 py-2.5 bg-white/70 focus:outline-none focus:ring-2 focus:ring-cherryDark"
            />
            <button
              disabled={criando || !nova.trim()}
              className="bg-cherryDark text-white rounded-full px-5 py-2.5 font-body font-semibold disabled:opacity-50"
            >
              {criando ? "Criando..." : "Criar"}
            </button>
          </div>
        </label>
        {aviso && <p className="text-sm font-body text-cherryDark">{aviso}</p>}
      </form>

      {carregando && <p className="font-body text-ink/60 mt-6">Carregando...</p>}

      {!carregando && lista.length === 0 && (
        <p className="font-body text-ink/60 mt-6">
          Nenhuma categoria ainda. Crie a primeira aí em cima — depois é só
          escolher a categoria de cada doce em <strong>Meus produtos</strong>. 🍒
        </p>
      )}

      <div className="grid gap-2 mt-5">
        {lista.map((c, i) => (
          <div
            key={c.id}
            className="bg-white/70 border border-cherryLight/30 rounded-xl p-3 flex flex-wrap items-center gap-2 font-body text-sm"
          >
            {editando === c.id ? (
              <>
                <input
                  value={nomeEditado}
                  onChange={(e) => setNomeEditado(e.target.value)}
                  autoFocus
                  className="flex-1 min-w-0 border border-cherryLight/50 rounded-lg px-3 py-2 bg-white"
                />
                <button
                  onClick={() => salvarNome(c.id)}
                  className="bg-cherryDark text-white rounded-full px-4 py-2.5 font-semibold"
                >
                  Salvar
                </button>
                <button onClick={() => setEditando(null)} className="text-ink/60 px-3 py-2.5">
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 min-w-0">
                  <span className="font-display text-base text-cherryDark">{c.nome}</span>
                  <span className="block text-xs text-ink/50">
                    {c.doces === 0
                      ? "nenhum doce nesta categoria"
                      : `${c.doces} ${c.doces === 1 ? "doce" : "doces"}`}
                  </span>
                </span>

                <button
                  onClick={() => mover(c.id, -1)}
                  disabled={i === 0}
                  aria-label={`Subir ${c.nome}`}
                  className="w-11 h-11 rounded-lg text-cherryDark disabled:opacity-25"
                >
                  ↑
                </button>
                <button
                  onClick={() => mover(c.id, 1)}
                  disabled={i === lista.length - 1}
                  aria-label={`Descer ${c.nome}`}
                  className="w-11 h-11 rounded-lg text-cherryDark disabled:opacity-25"
                >
                  ↓
                </button>
                <button
                  onClick={() => {
                    setEditando(c.id);
                    setNomeEditado(c.nome);
                  }}
                  className="text-cherryDark px-3 py-3 rounded-lg hover:bg-blush"
                >
                  Renomear
                </button>
                <button
                  onClick={() => remover(c)}
                  className="text-red-600 px-3 py-3 rounded-lg hover:bg-red-50"
                >
                  Remover
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
