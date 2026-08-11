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
 * O símbolo do Pix: um losango formado por quatro pontas que se encontram no
 * centro. Desenhado com quatro triângulos em volta de um quadrado girado.
 */
export function IconePix({ className = "w-6 h-6" }: Props) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label="Pix"
      fill="none"
    >
      <path
        d="M9.4 22.6a3.6 3.6 0 0 1-2.55-1.06l-3.6-3.6a1.32 1.32 0 0 1 0-1.87l3.6-3.6A3.6 3.6 0 0 1 9.4 11.4h1.1l-4.6 4.6 4.6 4.6H9.4Z"
        fill="#32BCAD"
      />
      <path
        d="M22.6 11.4c.96 0 1.87.38 2.55 1.06l3.6 3.6c.52.51.52 1.35 0 1.87l-3.6 3.6a3.6 3.6 0 0 1-2.55 1.06h-1.1l4.6-4.6-4.6-4.6h1.1Z"
        fill="#32BCAD"
      />
      <path
        d="M11.9 9.06 15.06 5.9a1.33 1.33 0 0 1 1.88 0l3.16 3.16a4.9 4.9 0 0 0-1.2-.16h-5.8c-.4 0-.81.05-1.2.16Z"
        fill="#32BCAD"
      />
      <path
        d="M20.1 22.94 16.94 26.1a1.33 1.33 0 0 1-1.88 0L11.9 22.94c.39.1.8.16 1.2.16h5.8c.41 0 .81-.05 1.2-.16Z"
        fill="#32BCAD"
      />
      {/* O losango do meio, que é o que dá a forma ao símbolo. */}
      <path
        d="M18.9 10.4c.67 0 1.31.27 1.78.74L24 14.46a2.18 2.18 0 0 1 0 3.08l-3.32 3.32c-.47.47-1.11.74-1.78.74h-5.8c-.67 0-1.31-.27-1.78-.74L8 17.54a2.18 2.18 0 0 1 0-3.08l3.32-3.32c.47-.47 1.11-.74 1.78-.74h5.8Z"
        fill="#32BCAD"
      />
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
