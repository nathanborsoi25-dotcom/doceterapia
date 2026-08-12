"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Gaveta que sobe por cima do cardápio.
 *
 * Aparece quando o cliente toca num doce sem sair da lista — fecha e ele
 * continua exatamente de onde parou. Como é uma rota de verdade (só
 * interceptada), o botão "voltar" do celular também fecha, que é o gesto que
 * todo mundo tenta primeiro.
 *
 * Fecha por: **arrastar para baixo**, botão ×, toque no fundo escuro, tecla
 * Esc e voltar do navegador.
 */

/** Quanto o dedo precisa descer para a gaveta fechar ao soltar. */
const DISTANCIA_PARA_FECHAR = 110;
/** Ou, se for um puxão rápido, esta velocidade já basta (px por ms). */
const VELOCIDADE_PARA_FECHAR = 0.5;

export default function Gaveta({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const painelRef = useRef<HTMLDivElement>(null);

  /**
   * O gesto em andamento. Fica em ref, e não em estado, porque muda a cada
   * frame do dedo — repintar o React a 60 vezes por segundo travaria a
   * animação justamente no aparelho mais fraco.
   */
  const gesto = useRef<{
    ativo: boolean;
    partiuDaAlcinha: boolean;
    yInicial: number;
    tInicial: number;
    dy: number;
  } | null>(null);

  const fechando = useRef(false);

  function fechar() {
    router.back();
  }

  /** Desliza o resto do caminho e só então volta pro cardápio. */
  function fecharDeslizando() {
    const painel = painelRef.current;
    if (fechando.current) return;
    fechando.current = true;

    if (!painel) return fechar();

    painel.style.transition = "transform 180ms cubic-bezier(0.4, 0, 1, 1)";
    painel.style.transform = "translateY(100%)";
    // O `router.back()` some com o componente; a espera é só pra animação
    // terminar antes disso.
    setTimeout(fechar, 170);
  }

  useEffect(() => {
    function noEsc(e: KeyboardEvent) {
      if (e.key === "Escape") fechar();
    }
    document.addEventListener("keydown", noEsc);

    // Onde o cardápio estava. Guardado ANTES de qualquer coisa mexer na
    // rolagem, pra devolver a pessoa exatamente ao doce que ela tocou.
    const rolagemDoCardapio = window.scrollY;

    // Trava a rolagem do fundo enquanto a gaveta está aberta, senão o dedo
    // rola o cardápio atrás em vez do conteúdo da gaveta.
    const overflowAntes = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    /*
     * Leva o foco pra dentro, pra quem usa teclado ou leitor de tela não
     * continuar navegando na lista que ficou atrás.
     *
     * ⚠️ `preventScroll` é obrigatório aqui. Sem ele, dar foco faz o
     * navegador rolar até o elemento — e como a gaveta é `fixed`, ele rolava
     * o CARDÁPIO até o fim. A pessoa fechava o doce e caía num lugar
     * completamente diferente de onde estava (1500px adiante, na medição).
     */
    painelRef.current?.focus({ preventScroll: true });

    return () => {
      document.removeEventListener("keydown", noEsc);
      document.body.style.overflow = overflowAntes;
      /*
       * Devolve o cardápio ao lugar. Instantâneo de propósito: o
       * `scroll-behavior: smooth` do CSS faria a lista deslizar sozinha
       * depois que a gaveta já sumiu, e o efeito é de site com defeito.
       */
      window.scrollTo({ top: rolagemDoCardapio, behavior: "instant" as ScrollBehavior });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function aoTocar(e: React.TouchEvent, partiuDaAlcinha: boolean) {
    if (fechando.current) return;
    const toque = e.touches[0];
    gesto.current = {
      ativo: false,
      partiuDaAlcinha,
      yInicial: toque.clientY,
      tInicial: Date.now(),
      dy: 0,
    };
  }

  function aoArrastar(e: React.TouchEvent) {
    const g = gesto.current;
    const painel = painelRef.current;
    if (!g || !painel || fechando.current) return;

    const dy = e.touches[0].clientY - g.yInicial;

    /*
     * Puxar para baixo com o conteúdo rolado significa "quero ler o que está
     * acima", não "quero fechar". Por isso o arrasto do CORPO só vale com a
     * gaveta no topo — na alcinha vale sempre, que é onde o dedo vai quando a
     * intenção é fechar mesmo.
     */
    if (!g.ativo) {
      if (dy <= 6) return; // ainda pode virar rolagem ou toque
      if (!g.partiuDaAlcinha && painel.scrollTop > 0) {
        gesto.current = null;
        return;
      }
      g.ativo = true;
      painel.style.transition = "none";
    }

    // Só para baixo, e com resistência: passar de uns 60% da tela não adianta.
    g.dy = Math.max(0, dy);
    const comResistencia = g.dy > 220 ? 220 + (g.dy - 220) * 0.35 : g.dy;
    painel.style.transform = `translateY(${comResistencia}px)`;

    // Enquanto arrasta, o navegador não deve rolar nada por baixo.
    if (e.cancelable) e.preventDefault();
  }

  function aoSoltar() {
    const g = gesto.current;
    const painel = painelRef.current;
    gesto.current = null;
    if (!g || !g.ativo || !painel || fechando.current) return;

    const velocidade = g.dy / Math.max(1, Date.now() - g.tInicial);

    if (g.dy > DISTANCIA_PARA_FECHAR || velocidade > VELOCIDADE_PARA_FECHAR) {
      fecharDeslizando();
      return;
    }

    // Não foi longe o bastante: volta pro lugar.
    painel.style.transition = "transform 200ms cubic-bezier(0.22, 1, 0.36, 1)";
    painel.style.transform = "translateY(0)";
  }

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
        onTouchStart={(e) => aoTocar(e, false)}
        onTouchMove={aoArrastar}
        onTouchEnd={aoSoltar}
        onTouchCancel={aoSoltar}
        className="relative w-full sm:max-w-3xl max-h-[92vh] sm:max-h-[88vh] overflow-y-auto bg-cream rounded-t-3xl sm:rounded-3xl shadow-2xl outline-none animate-[subir_220ms_cubic-bezier(0.22,1,0.36,1)] will-change-transform"
      >
        {/*
         * Alcinha: o sinal de "isto sobe e desce" — e agora o gesto de verdade.
         * `touch-none` tira o gesto do navegador aqui, senão ele tenta rolar a
         * gaveta e o arrasto nunca chega até nós.
         */}
        <div
          onTouchStart={(e) => aoTocar(e, true)}
          className="sticky top-0 z-10 bg-cream/95 backdrop-blur-sm pt-2 pb-1 flex justify-center sm:hidden touch-none cursor-grab active:cursor-grabbing"
        >
          {/* A área de toque é bem maior que o risquinho: o dedo não acerta
              uma faixa de 6px. */}
          <span className="flex items-center justify-center w-24 h-6 -my-1">
            <span className="w-10 h-1.5 rounded-full bg-cherryLight/70" />
          </span>
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
