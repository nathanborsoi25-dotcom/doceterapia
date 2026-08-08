"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import VoltarAoPainel from "@/components/VoltarAoPainel";
import {
  CAMPOS_POLITICA,
  POLITICA_PADRAO,
  type ChavePolitica,
} from "@/lib/politica";

/**
 * A Camily reescrevendo a página de regras da loja.
 *
 * Um campo por bloco, e não um editor de texto solto: assim ela mexe no que
 * quiser sem esbarrar na estrutura da página nem nos links (WhatsApp, Minha
 * conta), que continuam no código e sempre apontam pro lugar certo.
 *
 * Campo vazio volta pro texto de fábrica — apagar tudo por engano não deixa
 * um buraco na página que a cliente lê antes de comprar.
 */
export default function AdminPoliticaPage() {
  const [textos, setTextos] = useState<Partial<Record<ChavePolitica, string>>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    fetch("/api/config-loja", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => setTextos(c?.politica ?? {}))
      .catch(() => setErro("Não consegui carregar os textos. Tenta recarregar a página?"))
      .finally(() => setCarregando(false));
  }, []);

  function mudar(chave: ChavePolitica, valor: string) {
    setTextos((t) => ({ ...t, [chave]: valor }));
    setSalvo(false);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvando(true);
    try {
      // Só o que ela realmente escreveu vai pro banco; o resto fica no padrão.
      const limpo: Record<string, string> = {};
      for (const { chave } of CAMPOS_POLITICA) {
        const v = (textos[chave] ?? "").trim();
        if (v && v !== POLITICA_PADRAO[chave]) limpo[chave] = v;
      }
      const r = await fetch("/api/config-loja", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ politica: limpo }),
      });
      if (!r.ok) throw new Error();
      setSalvo(true);
      setTimeout(() => setSalvo(false), 3000);
    } catch {
      setErro("Não consegui salvar agora. Tenta de novo?");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <main className="min-h-screen px-4 sm:px-6 md:px-12 py-8 md:py-10 max-w-2xl mx-auto">
        <p className="font-body text-ink/60 text-center py-10">Carregando os textos...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 sm:px-6 md:px-12 py-8 md:py-10 max-w-2xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl sm:text-3xl text-cherryDark">
          Regras da loja
        </h1>
        <VoltarAoPainel />
      </div>
      <p className="font-body text-sm text-ink/60 mt-1">
        É a página que a cliente lê antes de comprar, com as regras de
        cancelamento, entrega e pagamento.{" "}
        <Link href="/politica" target="_blank" className="text-cherryDark underline">
          Ver como está no site
        </Link>
      </p>

      <div className="bg-blush/50 border border-cherryLight/40 rounded-2xl px-4 py-3 mt-5 font-body text-sm text-ink/75">
        <p>
          Escreva do seu jeito, como se estivesse falando com a cliente no
          WhatsApp. Duas dicas:
        </p>
        <ul className="list-disc pl-5 mt-1.5 grid gap-1 text-ink/65">
          <li>Deixe uma linha em branco para separar parágrafos.</li>
          <li>
            Comece a linha com <strong>-</strong> para virar uma listinha com
            bolinhas.
          </li>
        </ul>
        <p className="mt-2 text-ink/65">
          Campo deixado em branco volta para o texto original — nada fica vazio
          no site.
        </p>
      </div>

      <form onSubmit={salvar} className="grid gap-5 mt-6">
        {CAMPOS_POLITICA.map(({ chave, rotulo, ajuda }) => {
          const valor = textos[chave] ?? "";
          const usandoPadrao = !valor.trim();
          return (
            <label key={chave} className="grid gap-1 text-sm font-body text-ink/80">
              <span className="flex flex-wrap items-center gap-2">
                {rotulo}
                {usandoPadrao && (
                  <span className="text-[11px] font-body text-ink/45 bg-white/70 border border-cherryLight/40 rounded-full px-2 py-0.5">
                    texto original
                  </span>
                )}
              </span>
              <textarea
                value={valor}
                onChange={(e) => mudar(chave, e.target.value.slice(0, 2000))}
                rows={valor.length > 300 ? 8 : 4}
                placeholder={POLITICA_PADRAO[chave]}
                className="w-full border border-cherryLight/60 rounded-xl px-4 py-2.5 bg-white/70 focus:outline-none focus:ring-2 focus:ring-cherryDark resize-y leading-relaxed"
              />
              <span className="text-xs text-ink/50">{ajuda}</span>
            </label>
          );
        })}

        {erro && <p className="text-sm text-cherryDark font-body">{erro}</p>}
        {salvo && (
          <p className="text-sm font-body text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
            Prontinho, já está no site. 🍒
          </p>
        )}

        <button
          disabled={salvando}
          className="bg-cherryDark text-white rounded-full py-3 font-body font-semibold hover:bg-cherryMid transition-colors disabled:opacity-50"
        >
          {salvando ? "Salvando..." : "Salvar"}
        </button>

        <p className="text-xs text-ink/45 font-body text-center">
          Por ser venda pela internet, vale pedir para um advogado dar uma
          olhada no texto final.
        </p>
      </form>
    </main>
  );
}
