"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Estrelas from "@/components/Estrelas";
import { getTodasAvaliacoes, mostrarOuEsconderAvaliacao } from "@/lib/api";
import type { Avaliacao } from "@/lib/types";

/**
 * As notas que os clientes deram, para a Camily acompanhar.
 *
 * Ela não pode APAGAR uma avaliação — só esconder. Assim uma crítica honesta
 * não some, mas uma mensagem abusiva sai do ar (e sai da média) na hora.
 */
export default function AdminAvaliacoesPage() {
  const [lista, setLista] = useState<Avaliacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [soEscondidas, setSoEscondidas] = useState(false);

  useEffect(() => {
    getTodasAvaliacoes()
      .then(setLista)
      .catch(() => setLista([]))
      .finally(() => setCarregando(false));
  }, []);

  async function alternar(a: Avaliacao) {
    const visivel = !a.visivel;
    setLista((prev) => prev.map((x) => (x.id === a.id ? { ...x, visivel } : x)));
    await mostrarOuEsconderAvaliacao(a.id, visivel);
  }

  const media = useMemo(() => {
    const visiveis = lista.filter((a) => a.visivel);
    if (visiveis.length === 0) return 0;
    return visiveis.reduce((s, a) => s + a.nota, 0) / visiveis.length;
  }, [lista]);

  const visiveis = soEscondidas ? lista.filter((a) => !a.visivel) : lista;

  return (
    <main className="min-h-screen px-4 sm:px-6 md:px-12 py-8 md:py-10 max-w-3xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl sm:text-3xl text-cherryDark">
          Avaliações dos clientes
        </h1>
        <Link href="/admin" className="text-sm text-cherryDark underline font-body py-3 px-1">
          Voltar ao painel
        </Link>
      </div>

      {!carregando && lista.length > 0 && (
        <div className="bg-white/70 border border-cherryLight/30 rounded-cherry p-4 mt-4 flex flex-wrap items-center justify-between gap-3 font-body">
          <div>
            <p className="text-xs text-ink/50">Média da loja</p>
            <div className="flex items-center gap-2">
              <span className="font-display text-2xl text-cherryDark">
                {media.toFixed(1).replace(".", ",")}
              </span>
              <Estrelas nota={media} />
            </div>
            <p className="text-xs text-ink/50 mt-0.5">
              {lista.filter((a) => a.visivel).length} avaliação(ões) no ar
              {lista.some((a) => !a.visivel) &&
                ` · ${lista.filter((a) => !a.visivel).length} escondida(s)`}
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink/70">
            <input
              type="checkbox"
              checked={soEscondidas}
              onChange={(e) => setSoEscondidas(e.target.checked)}
              className="w-5 h-5 accent-cherryDark"
            />
            Ver só as escondidas
          </label>
        </div>
      )}

      {carregando && <p className="text-ink/60 font-body mt-6">Carregando...</p>}

      {!carregando && lista.length === 0 && (
        <p className="text-ink/60 font-body mt-6">
          Ninguém avaliou ainda. As notas aparecem aqui assim que os clientes
          receberem os pedidos e derem a opinião deles. 🍒
        </p>
      )}

      <div className="grid gap-3 mt-4">
        {visiveis.map((a) => (
          <div
            key={a.id}
            className={`border rounded-cherry p-4 grid gap-2 font-body text-sm ${
              a.visivel
                ? "bg-white/70 border-cherryLight/30"
                : "bg-ink/5 border-ink/10 opacity-75"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-display text-base text-cherryDark">
                {a.produtoNome}
              </span>
              <Estrelas nota={a.nota} />
            </div>
            {a.comentario ? (
              <p className="text-ink/80">&ldquo;{a.comentario}&rdquo;</p>
            ) : (
              <p className="text-ink/45 italic">Sem comentário — só a nota.</p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-cherryLight/20 pt-2">
              <span className="text-xs text-ink/50">
                {a.clienteNome} · {new Date(a.criadoEm).toLocaleDateString("pt-BR")}
                {!a.visivel && " · escondida do cardápio"}
              </span>
              <button
                onClick={() => alternar(a)}
                className={`text-xs font-semibold rounded-full px-4 py-2.5 border transition-colors ${
                  a.visivel
                    ? "text-cherryDark border-cherryLight/50 hover:bg-blush"
                    : "bg-cherryDark text-white border-cherryDark"
                }`}
              >
                {a.visivel ? "Esconder do cardápio" : "Mostrar de novo"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
