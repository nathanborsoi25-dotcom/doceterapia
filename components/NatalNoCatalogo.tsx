"use client";

import { useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";

const flocos = Array.from({ length: 38 }, (_, indice) => {
  const cristal = indice % 7 === 0;
  const duracao = 7 + (indice % 6) * 0.85;

  return {
    cristal,
    estilo: {
      "--floco-posicao": `${(indice * 37) % 101}%`,
      "--floco-tamanho": `${cristal ? 13 + (indice % 4) : 3 + (indice % 6)}px`,
      "--floco-atraso": `-${duracao * (((indice * 17) % 41) / 41)}s`,
      "--floco-desvio": `${(indice % 2 === 0 ? -1 : 1) * (14 + (indice % 5) * 6)}px`,
      "--floco-duracao": `${duracao}s`,
    } as CSSProperties,
  };
});

// Posições das luzes sobre a ilustração, em porcentagem do quadro da árvore.
const luzes = [
  [50, 8.4, 0.65], [58.8, 20.8, 1.05], [40.6, 24.7, 1.4],
  [38.6, 32.5, 1.85], [48, 37, 0.95], [72.6, 41.6, 1.45],
  [39, 44.8, 2.15], [64.9, 49.3, 1.2], [35.4, 59.6, 1.65],
  [47.5, 64.7, 2.25], [80.3, 68.6, 1.85], [52.8, 75.6, 2.45],
];

export default function NatalNoCatalogo() {
  const [neveAtiva, setNeveAtiva] = useState(true);

  return (
    <>
      {neveAtiva && (
        <div aria-hidden="true" className="natal-neve">
          {flocos.map(({ cristal, estilo }, indice) => (
            <span key={indice} className="natal-floco" style={estilo}>
              <span className={cristal ? "natal-floco-cristal" : "natal-floco-ponto"}>
                {cristal ? "❄" : null}
              </span>
            </span>
          ))}
        </div>
      )}

      <section className="natal-vitrine mx-auto mb-5 grid max-w-5xl grid-cols-[minmax(0,1fr)_45%] items-center gap-1.5 px-4 py-5 sm:grid-cols-[minmax(0,1fr)_45%] sm:gap-5 sm:px-10 sm:py-7 lg:px-14">
        <span aria-hidden="true" className="natal-ornamento natal-ornamento-esquerdo">✧</span>
        <button
          type="button"
          className="natal-controle-neve"
          aria-label="Neve na tela inteira"
          aria-pressed={neveAtiva}
          title={neveAtiva ? "Pausar neve" : "Ativar neve"}
          onClick={() => setNeveAtiva((ativa) => !ativa)}
        >
          <span aria-hidden="true">❄</span>
        </button>

        <div className="natal-texto relative min-w-0 py-2">
          <h1 className="font-display text-[clamp(1.45rem,5.3vw,4.25rem)] leading-none tracking-tight">
            <span className="block text-[0.67em] leading-tight">Natal na</span>
            <span className="block">Doceterapia</span>
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

        <div className="natal-cena w-full max-w-[330px] justify-self-center" aria-hidden="true">
          <div className="natal-pinheiro mx-auto w-[91%] max-w-[255px]">
            <Image
              src="/arvore-natal-doceterapia.png"
              alt=""
              width={600}
              height={721}
              sizes="(max-width: 639px) 40vw, 255px"
              priority
              className="h-auto w-full"
            />
            <div className="natal-luzes">
              {luzes.map(([x, y, atraso], indice) => (
                <span
                  key={x}
                  className={indice === 0 ? "natal-estrela" : undefined}
                  style={{
                    "--luz-x": `${x}%`,
                    "--luz-y": `${y}%`,
                    "--luz-atraso": `${atraso}s`,
                  } as CSSProperties}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
