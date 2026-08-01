"use client";

import { useState } from "react";
import Estrelas from "./Estrelas";
import { getAvaliacoesDoProduto } from "@/lib/api";
import type { Avaliacao } from "@/lib/types";

/**
 * Lista de comentários de um doce, dentro do card do cardápio.
 *
 * Só busca do servidor quando a pessoa clica pra abrir: se o cardápio
 * carregasse os comentários de todos os doces de uma vez, a primeira tela
 * ficaria pesada à toa no celular.
 */
export default function AvaliacoesDoProduto({
  produtoId,
  total,
}: {
  produtoId: string;
  total: number;
}) {
  const [aberto, setAberto] = useState(false);
  const [lista, setLista] = useState<Avaliacao[] | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function abrir() {
    setAberto((a) => !a);
    if (lista || carregando) return;
    setCarregando(true);
    try {
      setLista(await getAvaliacoesDoProduto(produtoId));
    } catch {
      setLista([]);
    } finally {
      setCarregando(false);
    }
  }

  if (total === 0) return null;

  return (
    <div className="mt-1">
      <button
        onClick={abrir}
        className="text-xs text-cherryDark underline font-body py-2"
      >
        {aberto ? "Esconder avaliações" : `Ver ${total === 1 ? "a avaliação" : `as ${total} avaliações`}`}
      </button>

      {aberto && (
        <div className="grid gap-2 mt-1">
          {carregando && <p className="text-xs text-ink/50 font-body">Carregando...</p>}
          {lista
            ?.filter((a) => a.comentario || a.nota)
            .map((a) => (
              <div key={a.id} className="bg-blush/50 rounded-xl p-2.5 font-body">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-ink/70 font-semibold">{a.clienteNome}</span>
                  <Estrelas nota={a.nota} tamanho="sm" />
                </div>
                {a.comentario && (
                  <p className="text-xs text-ink/70 mt-1">{a.comentario}</p>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
