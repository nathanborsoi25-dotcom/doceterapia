"use client";

import { useId } from "react";

/**
 * Os ícones das formas de pagamento.
 *
 * São desenhos nossos, em SVG, e não emoji: emoji de "cartão" muda de cara em
 * cada aparelho, e não existe emoji nenhum de Pix. Como estes
 * ícones dizem à pessoa *como ela vai pagar*, eles precisam ser reconhecidos
 * de imediato — e iguais no iPhone e no Android.
 *
 * Ficam em `currentColor` onde faz sentido, para herdar a cor do texto ao
 * lado; o Pix mantém o verde-água da marca, que é como todo mundo o conhece.
 */

type Props = { className?: string };

/**
 * O símbolo do Pix, como o Banco Central o desenha: quatro peças em forma de
 * seta apontando para o centro, que juntas fecham um losango e deixam um X
 * branco no meio.
 *
 * São quatro `path` separados de propósito — é o que forma o X sem precisar
 * desenhar um traço branco por cima. Assim o vão entre as peças acompanha o
 * tamanho do ícone e continua limpo em 20px ou em 200px.
 *
 * O turquesa `#32BCAD` é a cor oficial da marca; ela não herda a cor do texto
 * ao lado, porque é justamente por ela que as pessoas reconhecem o Pix.
 */
export function IconePix({ className = "w-6 h-6" }: Props) {
  /*
   * O `id` do recorte precisa ser único na página: dois ícones do Pix na
   * mesma tela com o mesmo id fariam o segundo usar o recorte do primeiro.
   */
  const recorte = useId().replace(/:/g, "");

  return (
    <svg viewBox="0 0 512 512" className={className} role="img" aria-label="Pix">
      <defs>
        <clipPath id={recorte}>
          {/*
           * O losango é um quadrado girado 45°, com cantos arredondados —
           * geometria simples em vez de um path desenhado à mão, que foi
           * onde a primeira tentativa deste ícone se perdeu.
           */}
          <rect
            x="92"
            y="92"
            width="328"
            height="328"
            rx="74"
            transform="rotate(45 256 256)"
          />
        </clipPath>
      </defs>

      <rect
        x="92"
        y="92"
        width="328"
        height="328"
        rx="74"
        transform="rotate(45 256 256)"
        fill="#32BCAD"
      />

      {/*
       * O X do meio: duas faixas brancas que se encontram no centro, uma em
       * "V" e outra em "Λ". O recorte corta as pontas na borda do losango,
       * então elas nunca vazam para fora da marca.
       */}
      <g
        clipPath={`url(#${recorte})`}
        stroke="#fff"
        strokeWidth="46"
        strokeLinecap="round"
        fill="none"
      >
        <path d="M104 104Q180 180 256 256Q332 180 408 104" />
        <path d="M104 408Q180 332 256 256Q332 332 408 408" />
      </g>
    </svg>
  );
}

/** Um cartão: retângulo com a tarja e o chip. */
export function IconeCartao({ className = "w-6 h-6" }: Props) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label="Cartão de crédito"
      fill="none"
    >
      <rect
        x="2.5"
        y="6.5"
        width="27"
        height="19"
        rx="3"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* A tarja preta, que é o que faz o desenho "virar" cartão. */}
      <path d="M2.5 12.5h27" stroke="currentColor" strokeWidth="3" />
      <rect x="6" y="17" width="7" height="4.5" rx="1" fill="currentColor" />
    </svg>
  );
}

