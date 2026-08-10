"use client";

import { useEffect, useState } from "react";
import { getMinhaConta, type MinhaConta } from "@/lib/api";
import { reais } from "@/lib/formato";

/** Quantos dias inteiros faltam até o cupom vencer. */
function diasAte(expiraEm: string | null): number | null {
  if (!expiraEm) return null;
  const falta = new Date(expiraEm).getTime() - Date.now();
  return Math.floor(falta / 86400000);
}

/** Está acabando? Aí o prazo aparece em destaque, não em cinza. */
function prazoApertado(expiraEm: string | null): boolean {
  const dias = diasAte(expiraEm);
  return dias !== null && dias <= 3;
}

/**
 * O prazo em português de gente. "Vence 31/08/2026" não faz ninguém correr;
 * "vence hoje" faz. Cupom vencido nem chega aqui — a lista já vem peneirada
 * pelo servidor.
 */
function textoDoPrazo(expiraEm: string | null): string {
  const dias = diasAte(expiraEm);
  if (dias === null) return "sem prazo pra usar";
  if (dias <= 0) return "vence hoje!";
  if (dias === 1) return "vence amanhã!";
  if (dias <= 6) return `vence em ${dias} dias`;
  return `vale até ${new Date(expiraEm!).toLocaleDateString("pt-BR")}`;
}

/**
 * Pontos, extrato e cupons do cliente.
 *
 * O saldo é a soma do extrato — por isso mostramos os dois juntos: a pessoa
 * consegue conferir de onde veio cada ponto em vez de confiar num número solto.
 */
export default function PontosECupons() {
  const [conta, setConta] = useState<MinhaConta | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [copiado, setCopiado] = useState("");

  useEffect(() => {
    getMinhaConta()
      .then(setConta)
      .catch(() => setConta(null))
      .finally(() => setCarregando(false));
  }, []);

  async function copiar(codigo: string) {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(codigo);
      setTimeout(() => setCopiado(""), 2000);
    } catch {
      // Sem permissão de área de transferência: a pessoa copia na mão mesmo.
    }
  }

  if (carregando) {
    return <p className="font-body text-ink/60 text-center py-8">Carregando...</p>;
  }
  if (!conta) {
    return (
      <p className="font-body text-ink/60 text-center py-8">
        Não foi possível carregar seus pontos agora.
      </p>
    );
  }

  return (
    <div className="grid gap-6 font-body text-sm">
      <div className="bg-cherryDark text-white rounded-2xl p-5 text-center">
        <p className="text-white/70 text-xs uppercase tracking-wide">Seus pontos</p>
        <p className="font-display text-4xl mt-1">{conta.saldoPontos}</p>
        <p className="text-white/70 text-xs mt-1">
          Você ganha pontos a cada compra e a cada avaliação.
        </p>
      </div>

      {conta.recompensas.length > 0 && (
        <section>
          <h3 className="font-display text-lg text-cherryDark">O que dá pra trocar</h3>
          <div className="grid gap-2 mt-2">
            {conta.recompensas.map((r) => {
              const falta = r.pontos - conta.saldoPontos;
              return (
                <div
                  key={r.id}
                  className="bg-white/70 border border-cherryLight/30 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-ink/80 font-semibold">{r.nome}</p>
                    {r.descricao && <p className="text-ink/60 text-xs">{r.descricao}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-cherryDark font-semibold">{r.pontos} pts</p>
                    <p className="text-xs text-ink/50">
                      {falta <= 0 ? "Você já pode resgatar!" : `faltam ${falta}`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-ink/50 mt-2">
            Para resgatar, é só falar com a Camily no WhatsApp na hora do pedido.
          </p>
        </section>
      )}

      <section>
        <h3 className="font-display text-lg text-cherryDark">Cupons disponíveis pra você</h3>
        {conta.cupons.length === 0 ? (
          <p className="text-ink/60 mt-2">
            Nenhum cupom no momento. Fique de olho — a Camily solta promoções de
            vez em quando. 🍒
          </p>
        ) : (
          <div className="grid gap-2 mt-2">
            {conta.cupons.map((c) => (
              <div
                key={c.codigo}
                className="bg-white/70 border border-dashed border-cherryLight rounded-xl p-3 grid gap-1"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-display text-lg text-cherryDark tracking-wide">
                    {c.codigo}
                  </span>
                  <button
                    onClick={() => copiar(c.codigo)}
                    className={`text-xs font-semibold rounded-full px-3 py-2 border transition-colors ${
                      copiado === c.codigo
                        ? "bg-green-100 text-green-800 border-green-200"
                        : "text-cherryDark border-cherryLight/50 hover:bg-blush"
                    }`}
                  >
                    {copiado === c.codigo ? "Copiado!" : "Copiar código"}
                  </button>
                </div>
                <p className="text-ink/70">
                  {c.tipo === "percentual"
                    ? `${c.valor}% de desconto`
                    : `${reais(c.valor)} de desconto`}
                  {c.pedidoMinimo > 0 && ` · a partir de ${reais(c.pedidoMinimo)}`}
                </p>
                {c.descricao && <p className="text-ink/60 text-xs">{c.descricao}</p>}

                {/* Só no Pix é condição de uso, não detalhe: se ela descobrir
                    isso só na hora de pagar, a compra trava. */}
                {c.somentePix && (
                  <p className="text-xs font-semibold text-green-800 bg-green-50 border border-green-200 rounded-lg px-2 py-1 justify-self-start">
                    Vale pagando no Pix
                  </p>
                )}

                {/* O prazo vem em destaque quando está acabando — é o que faz
                    a pessoa usar o cupom em vez de deixar vencer. */}
                <p
                  className={`text-xs ${
                    prazoApertado(c.expiraEm) ? "text-cherryDark font-semibold" : "text-ink/45"
                  }`}
                >
                  {c.exclusivo && "Exclusivo pra você · "}
                  {textoDoPrazo(c.expiraEm)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="font-display text-lg text-cherryDark">De onde vieram seus pontos</h3>
        {conta.extrato.length === 0 ? (
          <p className="text-ink/60 mt-2">Seu extrato ainda está vazio.</p>
        ) : (
          <ul className="grid gap-1 mt-2">
            {conta.extrato.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 border-b border-cherryLight/20 py-2"
              >
                <span className="min-w-0">
                  <span className="text-ink/80">{p.descricao || p.motivo}</span>
                  <span className="block text-xs text-ink/45">
                    {new Date(p.criadoEm).toLocaleDateString("pt-BR")}
                  </span>
                </span>
                <span
                  className={`shrink-0 font-semibold ${
                    p.quantidade >= 0 ? "text-green-700" : "text-cherryDark"
                  }`}
                >
                  {p.quantidade >= 0 ? "+" : ""}
                  {p.quantidade}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
