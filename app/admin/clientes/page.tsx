"use client";

import { useEffect, useMemo, useState } from "react";
import VoltarAoPainel from "@/components/VoltarAoPainel";
import { getListaClientes } from "@/lib/api";
import type { Cliente } from "@/lib/types";

/**
 * Tira acento e caixa alta pra comparar. Sem isso, procurar por "jose" não
 * acharia a "Josefa" — e é assim que a Camily digita, no corre da cozinha.
 */
function semAcento(texto: string): string {
  return texto
    .normalize("NFD")
    // Os sinais que o NFD separa da letra (U+0300 a U+036F).
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Só os números, pra procurar telefone sem depender de parênteses e traço. */
function soDigitos(texto: string): string {
  return texto.replace(/\D/g, "");
}

export default function AdminClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    getListaClientes()
      .then(setClientes)
      .catch(() => setClientes([]))
      .finally(() => setCarregando(false));
  }, []);

  /**
   * Procura em nome, e-mail, telefone e endereço ao mesmo tempo: ela nem
   * sempre lembra o nome completo, mas lembra a rua ou o final do telefone.
   */
  const encontrados = useMemo(() => {
    const termo = semAcento(busca);
    if (!termo) return clientes;
    const digitos = soDigitos(busca);

    return clientes.filter((c) => {
      const texto = semAcento(
        [
          c.nome,
          c.email,
          c.telefone,
          c.endereco.rua,
          c.endereco.numero,
          c.endereco.bairro,
          c.endereco.cidade,
        ]
          .filter(Boolean)
          .join(" ")
      );
      if (texto.includes(termo)) return true;
      // Telefone digitado sem formatação.
      return digitos.length >= 3 && soDigitos(c.telefone ?? "").includes(digitos);
    });
  }, [clientes, busca]);

  return (
    <main className="min-h-screen px-4 sm:px-6 md:px-12 py-8 md:py-10 max-w-3xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl sm:text-3xl text-cherryDark">Meus clientes</h1>
        <VoltarAoPainel />
      </div>

      <div className="mt-4 grid gap-1.5">
        <div className="relative">
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Procurar por nome, e-mail, telefone ou rua"
            aria-label="Procurar cliente"
            className="w-full border border-cherryLight/50 rounded-full pl-11 pr-4 py-3 bg-white/70 font-body text-sm focus:outline-none focus:ring-2 focus:ring-cherryDark"
          />
          <span
            aria-hidden="true"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/40 text-base"
          >
            🔎
          </span>
        </div>

        {!carregando && (
          <p className="text-xs font-body text-ink/50">
            {busca.trim()
              ? `${encontrados.length} ${encontrados.length === 1 ? "cliente encontrado" : "clientes encontrados"} de ${clientes.length}`
              : `${clientes.length} ${clientes.length === 1 ? "cliente cadastrado" : "clientes cadastrados"}`}
          </p>
        )}
      </div>

      <div className="grid gap-3 mt-4">
        {carregando && <p className="text-ink/60 font-body">Carregando seus clientes...</p>}

        {!carregando && clientes.length === 0 && (
          <p className="text-ink/60 font-body">Ainda não há clientes cadastrados.</p>
        )}

        {!carregando && clientes.length > 0 && encontrados.length === 0 && (
          <div className="text-center py-8 grid gap-2">
            <span className="text-4xl">🔎</span>
            <p className="text-ink/70 font-body">
              Não achei ninguém com &ldquo;{busca.trim()}&rdquo;.
            </p>
            <button
              onClick={() => setBusca("")}
              className="justify-self-center text-sm font-body text-cherryDark underline min-h-[44px] px-2"
            >
              Ver todos de novo
            </button>
          </div>
        )}

        {encontrados.map((c) => (
          <div key={c.id} className="bg-white/70 border border-cherryLight/30 rounded-xl p-4 font-body text-sm">
            <p className="font-display text-base text-cherryDark">{c.nome}</p>
            {/* O e-mail é por onde a cliente entra no site: é ele que a Camily
                precisa ter à mão quando alguém liga dizendo que não consegue
                acessar a conta. */}
            <p className="break-words">E-mail: {c.email}</p>
            <p>Telefone: {c.telefone}</p>
            <p>
              Endereço: {c.endereco.rua}, {c.endereco.numero} — {c.endereco.bairro},{" "}
              {c.endereco.cidade}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
