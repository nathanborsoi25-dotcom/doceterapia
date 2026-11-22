import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";

const flocos = [
  [3, 4, 0.1, -13], [8, 7, 0.8, 26], [14, 3, 0, 18],
  [20, 5, 1.3, -23], [26, 3, 0.5, 12], [32, 6, 1.1, 24],
  [37, 4, 0, -16], [43, 7, 0.7, 28], [49, 3, 1.4, -15],
  [55, 4, 0.4, 22], [61, 6, 1.2, -26], [66, 3, 0.2, 18],
  [71, 5, 0.9, -24], [76, 3, 1.5, 13], [82, 6, 0.6, -21],
  [87, 3, 0.1, 18], [92, 7, 1, -24], [97, 4, 0.5, -16],
];

export default function NatalNoCatalogo() {
  return (
    <section className="natal-vitrine mx-auto mb-5 grid max-w-5xl grid-cols-[1fr_36%] items-center gap-2 px-4 py-5 sm:grid-cols-[1fr_34%] sm:gap-8 sm:px-10 sm:py-6">
      <div aria-hidden="true" className="natal-neve">
        {flocos.map(([posicao, tamanho, atraso, desvio]) => (
          <span
            key={posicao}
            style={{
              "--floco-posicao": `${posicao}%`,
              "--floco-tamanho": `${tamanho}px`,
              "--floco-atraso": `${atraso}s`,
              "--floco-desvio": `${desvio}px`,
              "--floco-duracao": `${2.5 + tamanho * 0.2}s`,
            } as CSSProperties}
          />
        ))}
      </div>

      <div className="relative min-w-0">
        <h1 className="font-display text-[clamp(1.5rem,4.5vw,3.5rem)] leading-[1.06] tracking-tight">
          Natal na Doceterapia
        </h1>
        <p className="mt-2 max-w-sm text-base leading-snug sm:mt-3 sm:text-lg">
          Doces artesanais para presentear e compartilhar.
        </p>
        <Link
          href="/loja"
          className="natal-perfil mt-3 inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-bold sm:mt-5 sm:px-5"
        >
          Perfil da loja
        </Link>
      </div>

      <Image
        src="/natal-doceterapia-2026.jpg"
        alt=""
        width={640}
        height={640}
        sizes="(max-width: 639px) 34vw, 270px"
        priority
        className="natal-arte relative w-full max-w-[270px] justify-self-end"
      />
    </section>
  );
}
