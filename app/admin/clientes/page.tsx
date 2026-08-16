"use client";

import { useEffect, useMemo, useState } from "react";
import VoltarAoPainel from "@/components/VoltarAoPainel";
import { getListaClientes } from "@/lib/api";
import type { ClienteDoPainel } from "@/lib/types";

/**
 * Como a lista vem ordenada.
 *
 * "Mais pontos" existe para a Camily achar quem está perto de um prêmio — é a
 * pergunta que ela faz quando quer chamar alguém pra voltar, e a ordem por
 * data de cadastro não responde isso.
 */
type Ordem = "recentes" | "pontos" | "nome";

const ORDENS: { valor: Ordem; label: string }[] = [
  { valor: "recentes", label: "Mais recentes" },
  { valor: "pontos", label: "Mais pontos" },
  { valor: "nome", label: "Nome" },
];

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
  const [clientes, setClientes] = useState<ClienteDoPainel[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("recentes");

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

  /*
   * A ordem é aplicada DEPOIS da busca, sobre uma cópia.
   *
   * `sort` mexe no próprio array, e ordenar o `clientes` original faria a
   * lista embaralhar sozinha por baixo da busca. A lista já chega do servidor
   * por data de cadastro, então "mais recentes" é só devolver o que veio.
   */
  const listados = useMemo(() => {
    const copia = [...encontrados];
    if (ordem === "pontos") {
      // Empate desfeito pelo nome, senão a ordem de quem tem zero ponto muda
      // a cada carregamento e a tela parece instável.
      return copia.sort((a, b) => b.pontos - a.pontos || a.nome.localeCompare(b.nome, "pt-BR"));
    }
    if (ordem === "nome") {
      return copia.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    }
    return copia;
  }, [encontrados, ordem]);

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

      {/* Fileira que rola de lado no celular, como a dos pedidos. */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 mt-3 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible">
        <span className="self-center font-body text-xs text-ink/50 shrink-0">Ordenar por:</span>
        {ORDENS.map((o) => (
          <button
            key={o.valor}
            onClick={() => setOrdem(o.valor)}
            aria-pressed={ordem === o.valor}
            className={`shrink-0 rounded-full px-4 min-h-[44px] font-body text-sm border transition-colors ${
              ordem === o.valor
                ? "bg-cherryDark text-white border-cherryDark"
                : "bg-white/70 text-ink/70 border-cherryLight/50 hover:border-cherryMid"
            }`}
          >
            {o.label}
          </button>
        ))}
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

        {listados.map((c) => (
          <div key={c.id} className="bg-white/70 border border-cherryLight/30 rounded-xl p-4 font-body text-sm">
            {/* `min-w-0` no nome: sem ele, um nome comprido empurra a etiqueta
                de pontos pra fora do card no celular. */}
            <div className="flex items-start justify-between gap-3">
              <p className="font-display text-base text-cherryDark min-w-0">{c.nome}</p>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                  c.pontos > 0 ? "bg-blush text-cherryDark" : "bg-ink/5 text-ink/45"
                }`}
              >
                {c.pontos > 0
                  ? `🍒 ${c.pontos} ${c.pontos === 1 ? "ponto" : "pontos"}`
                  : "sem pontos"}
              </span>
            </div>
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
