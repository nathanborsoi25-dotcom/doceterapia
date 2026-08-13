"use client";

import type { Aviso } from "@/lib/usar-aviso-salvo";

/**
 * A faixa de "salvei" (ou "não deu") das telas do painel.
 *
 * Fica grudada acima da barra do sistema para aparecer perto do polegar, que
 * é onde o botão de salvar acabou de ser tocado — no topo da tela a Camily
 * não veria a confirmação sem rolar de volta.
 *
 * `role="status"` faz o leitor de tela anunciar sozinho; o erro vai como
 * `alert`, que interrompe a leitura, porque exige ação.
 */
export default function AvisoSalvo({ aviso }: { aviso: Aviso }) {
  if (!aviso) return null;
  const deuCerto = aviso.tipo === "salvo";

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pointer-events-none flex justify-center"
      role={deuCerto ? "status" : "alert"}
      aria-live={deuCerto ? "polite" : "assertive"}
    >
      <div
        className={`flex items-center gap-2.5 rounded-2xl px-4 py-3 shadow-lg font-body text-sm max-w-md w-full sm:w-auto ${
          deuCerto
            ? "bg-green-600 text-white"
            : "bg-white border-2 border-cherryDark text-cherryDark"
        }`}
      >
        {deuCerto ? (
          <IconeCerto />
        ) : (
          <span aria-hidden className="text-lg leading-none">
            !
          </span>
        )}
        <span>{aviso.texto}</span>
      </div>
    </div>
  );
}

/**
 * O certinho, desenhado como geometria simples: um círculo e uma polilinha de
 * três pontos. Path escrito à mão em ícone pequeno é onde já saiu borrão
 * antes (ver o símbolo do Pix) — aqui não há curva para errar.
 */
function IconeCerto() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-5 h-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" strokeWidth={2} />
      <polyline points="8,12.5 11,15.5 16,9.5" />
    </svg>
  );
}
