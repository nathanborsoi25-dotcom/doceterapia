"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Gaveta que sobe por cima do cardápio.
 *
 * Aparece quando a cliente toca num doce sem sair da lista — fecha e ela
 * continua exatamente de onde parou. Como é uma rota de verdade (só
 * interceptada), o botão "voltar" do celular também fecha, que é o gesto que
 * todo mundo tenta primeiro.
 *
 * Fecha por: botão, toque no fundo escuro, tecla Esc e voltar do navegador.
 */
export default function Gaveta({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const painelRef = useRef<HTMLDivElement>(null);

  function fechar() {
    router.back();
  }

  useEffect(() => {
    function noEsc(e: KeyboardEvent) {
      if (e.key === "Escape") fechar();
    }
    document.addEventListener("keydown", noEsc);

    // Trava a rolagem do fundo enquanto a gaveta está aberta, senão o dedo
    // rola o cardápio atrás em vez do conteúdo da gaveta.
    const rolagemAntes = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Leva o foco pra dentro, pra quem usa teclado ou leitor de tela não
    // continuar navegando na lista que ficou atrás.
    painelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", noEsc);
      document.body.style.overflow = rolagemAntes;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Detalhes do doce"
    >
      {/* Fundo escuro: tocar aqui fecha */}
      <button
        onClick={fechar}
        aria-label="Fechar"
        className="absolute inset-0 bg-ink/50 backdrop-blur-[2px] animate-[fadeIn_150ms_ease-out]"
      />

      <div
        ref={painelRef}
        tabIndex={-1}
        className="relative w-full sm:max-w-3xl max-h-[92vh] sm:max-h-[88vh] overflow-y-auto bg-cream rounded-t-3xl sm:rounded-3xl shadow-2xl outline-none animate-[subir_220ms_cubic-bezier(0.22,1,0.36,1)]"
      >
        {/* Alcinha: o sinal visual de "isto sobe e desce" no celular */}
        <div className="sticky top-0 z-10 bg-cream/95 backdrop-blur-sm pt-2 pb-1 flex justify-center sm:hidden">
          <span className="w-10 h-1.5 rounded-full bg-cherryLight/70" />
        </div>

        <button
          onClick={fechar}
          aria-label="Fechar"
          className="absolute top-3 right-3 z-20 w-11 h-11 rounded-full bg-white/85 text-cherryDark text-xl shadow-sm hover:bg-white transition-colors"
        >
          ×
        </button>

        <div className="p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
