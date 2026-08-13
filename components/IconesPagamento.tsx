"use client";

import { useId } from "react";

/**
 * Os ícones das formas de pagamento.
 *
 * São desenhos nossos, em SVG, e não emoji: emoji de "cartão" muda de cara em
 * cada aparelho, e não existe emoji nenhum de Pix nem de Apple Pay. Como estes
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

/**
 * Apple Pay: a maçã seguida da palavra "Pay", que é como a Apple pede que a
 * forma seja mostrada. Em preto sobre fundo claro, sem caixa em volta.
 */
export function IconeApplePay({ className = "w-6 h-6" }: Props) {
  return (
    <svg
      viewBox="0 0 44 24"
      className={className}
      role="img"
      aria-label="Apple Pay"
      fill="currentColor"
    >
      {/* folhinha */}
      <path d="M12.3 5.2c.6-.75.99-1.77.89-2.8-.85.04-1.9.58-2.52 1.31-.55.65-1.04 1.7-.91 2.7.96.08 1.93-.48 2.54-1.21Z" />
      {/* corpo da maçã */}
      <path d="M13.18 6.6c-1.4-.08-2.58.79-3.25.79-.66 0-1.68-.75-2.77-.73-1.42.02-2.74.83-3.47 2.1-1.48 2.57-.38 6.37 1.06 8.46.7 1.03 1.54 2.18 2.64 2.14 1.06-.04 1.46-.68 2.74-.68 1.27 0 1.63.68 2.75.66 1.14-.02 1.86-1.04 2.55-2.07.8-1.18 1.13-2.33 1.15-2.39-.02-.01-2.2-.85-2.23-3.37-.02-2.11 1.72-3.12 1.8-3.17-.98-1.45-2.51-1.61-3.05-1.65Z" />
      {/* "Pay" */}
      <text
        x="20"
        y="18"
        fontSize="13"
        fontFamily="system-ui, -apple-system, Helvetica, Arial, sans-serif"
        fontWeight="500"
      >
        Pay
      </text>
    </svg>
  );
}
