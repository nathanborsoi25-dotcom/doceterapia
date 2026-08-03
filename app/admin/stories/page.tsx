"use client";

import { useEffect, useMemo, useState } from "react";
import VoltarAoPainel from "@/components/VoltarAoPainel";
import { decidirStory, getStoriesDoPainel } from "@/lib/api";
import { linkWhatsAppNumero } from "@/lib/contato";
import type { StoryEnviado } from "@/lib/types";

/**
 * Os stories que as clientes mandaram, esperando a Camily liberar os pontos.
 *
 * A tela mostra o print grande de propósito: a decisão dela é olhar a foto e
 * tocar em aprovar. Os pontos só entram nesse toque.
 */
export default function AdminStoriesPage() {
  const [lista, setLista] = useState<StoryEnviado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [decidindo, setDecidindo] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [verTodos, setVerTodos] = useState(false);

  useEffect(() => {
    getStoriesDoPainel()
      .then(setLista)
      .catch(() => setLista([]))
      .finally(() => setCarregando(false));
  }, []);

  async function decidir(story: StoryEnviado, aprovar: boolean) {
    setDecidindo(story.id);
    setAviso("");
    try {
      const r = await decidirStory(story.id, aprovar);
      setLista((prev) =>
        prev.map((s) =>
          s.id === story.id
            ? {
                ...s,
                situacao: aprovar ? "aprovado" : "recusado",
                pontosCreditados: r.pontos,
              }
            : s
        )
      );
      if (aprovar) {
        setAviso(`Pronto! ${story.clienteNome} ganhou ${r.pontos} pontos.`);
      }
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "Não foi possível decidir agora.");
    } finally {
      setDecidindo(null);
    }
  }

  const pendentes = useMemo(
    () => lista.filter((s) => s.situacao === "pendente"),
    [lista]
  );
  const visiveis = verTodos ? lista : pendentes;

  return (
    <main className="min-h-screen px-4 sm:px-6 md:px-12 py-8 md:py-10 max-w-3xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl sm:text-3xl text-cherryDark">
          Stories das clientes
        </h1>
        <VoltarAoPainel />
      </div>
      <p className="text-sm font-body text-ink/60 mt-1">
        Elas postam marcando você e mandam o print. Confira e libere os pontos.
        {pendentes.length > 0 && (
          <span className="text-cherryDark font-semibold">
            {" "}
            {pendentes.length} esperando você.
          </span>
        )}
      </p>

      {lista.length > pendentes.length && (
        <label className="flex items-center gap-2 text-sm font-body text-ink/70 mt-3">
          <input
            type="checkbox"
            checked={verTodos}
            onChange={(e) => setVerTodos(e.target.checked)}
            className="w-5 h-5 accent-cherryDark"
          />
          Ver também os que já decidi
        </label>
      )}

      {aviso && (
        <p className="mt-4 text-sm font-body text-cherryDark bg-blush/70 border border-cherryLight/50 rounded-xl px-4 py-3">
          {aviso}
        </p>
      )}

      {carregando && <p className="text-ink/60 font-body mt-6">Carregando...</p>}

      {!carregando && visiveis.length === 0 && (
        <p className="text-ink/60 font-body mt-6">
          {lista.length === 0
            ? "Nenhuma cliente mandou story ainda. Assim que mandarem, aparece aqui. 🍒"
            : "Tudo decidido por aqui! 🍒"}
        </p>
      )}

      <div className="grid gap-4 mt-4">
        {visiveis.map((s) => (
          <div
            key={s.id}
            className={`border rounded-2xl p-4 grid gap-3 font-body text-sm ${
              s.situacao === "pendente"
                ? "bg-white/70 border-cherryLight/30"
                : "bg-ink/5 border-ink/10"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-ink/80">
                <strong>{s.clienteNome}</strong>
                {s.arroba && <span className="text-cherryMid"> · @{s.arroba}</span>}
              </span>
              <span className="text-xs text-ink/45">
                {new Date(s.criadoEm).toLocaleDateString("pt-BR")}
              </span>
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.imagemUrl}
              alt={`Story enviado por ${s.clienteNome}`}
              className="w-full max-h-[420px] object-contain rounded-xl bg-blush/40"
            />

            {s.situacao === "pendente" ? (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => decidir(s, true)}
                  disabled={decidindo === s.id}
                  className="bg-cherryDark text-white rounded-full px-5 py-3 font-semibold disabled:opacity-50"
                >
                  {decidindo === s.id ? "Liberando..." : "Aprovar e dar os pontos"}
                </button>
                <button
                  onClick={() => decidir(s, false)}
                  disabled={decidindo === s.id}
                  className="text-cherryDark border border-cherryLight/50 rounded-full px-5 py-3 font-semibold hover:bg-blush disabled:opacity-50"
                >
                  Recusar
                </button>
                {s.clienteTelefone && (
                  <a
                    href={linkWhatsAppNumero(
                      s.clienteTelefone,
                      `Oi! Aqui é a Camily, da Doceterapia 🍒 Vi seu story, muito obrigada por divulgar!`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#25D366] border border-[#25D366]/40 rounded-full px-5 py-3 font-semibold hover:bg-[#25D366]/10"
                  >
                    Agradecer no WhatsApp
                  </a>
                )}
              </div>
            ) : (
              <p
                className={`text-xs font-semibold ${
                  s.situacao === "aprovado" ? "text-green-700" : "text-ink/50"
                }`}
              >
                {s.situacao === "aprovado"
                  ? `Aprovado — ${s.pontosCreditados} pontos creditados.`
                  : "Recusado."}
              </p>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
