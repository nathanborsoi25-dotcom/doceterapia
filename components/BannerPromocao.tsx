"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { bannersVisiveis, type BannerDaLoja } from "@/lib/banners";

/**
 * Os destaques do topo do cardápio, em carrossel.
 *
 * É a primeira coisa que a cliente vê ao abrir o site pelo Instagram, então
 * ele arrasta com o dedo, do mesmo jeito que ela já está acostumada. O banner
 * do meio fica em destaque e os vizinhos aparecem pela metade nas beiradas —
 * essa espiada é o que conta que tem mais coisa pro lado, sem precisar de
 * seta nem de aviso escrito.
 *
 * A Camily liga, desliga e edita tudo em /admin/promocoes.
 */
export default function BannerPromocao() {
  const [banners, setBanners] = useState<BannerDaLoja[]>([]);
  const [atual, setAtual] = useState(0);
  const trilho = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/config-loja", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((config) => setBanners(bannersVisiveis(config)))
      .catch(() => setBanners([]));
  }, []);

  if (banners.length === 0) return null;

  const varios = banners.length > 1;

  /** Qual banner está no meio da tela agora, pro pontinho certo acender. */
  function acompanharRolagem(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const meio = el.scrollLeft + el.clientWidth / 2;
    let maisPerto = 0;
    let menorDistancia = Infinity;
    Array.from(el.children).forEach((filho, i) => {
      const item = filho as HTMLElement;
      const centro = item.offsetLeft + item.offsetWidth / 2;
      const distancia = Math.abs(centro - meio);
      if (distancia < menorDistancia) {
        menorDistancia = distancia;
        maisPerto = i;
      }
    });
    setAtual(maisPerto);
  }

  function irPara(i: number) {
    const el = trilho.current;
    const item = el?.children[i] as HTMLElement | undefined;
    if (!el || !item) return;
    el.scrollTo({
      left: item.offsetLeft - (el.clientWidth - item.offsetWidth) / 2,
      behavior: "smooth",
    });
  }

  return (
    <section aria-label="Destaques" className="mb-8">
      {/*
       * As margens negativas levam o trilho até a beirada da tela: é o que
       * permite o banner vizinho espiar. O `px` de dentro devolve o respiro,
       * pra o primeiro e o último não colarem na borda.
       */}
      <div
        ref={trilho}
        onScroll={varios ? acompanharRolagem : undefined}
        className={`flex gap-3 overflow-x-auto overscroll-x-contain snap-x snap-mandatory pb-1 -mx-4 px-4 sm:-mx-6 sm:px-6 ${
          varios ? "" : "justify-center"
        }`}
      >
        {banners.map((b) => (
          <Link
            key={b.id}
            href={b.link || "/catalogo"}
            className={`snap-center shrink-0 bg-white/70 border border-cherryLight/40 rounded-2xl overflow-hidden hover:border-cherryDark transition-colors ${
              /* Com vários, sobra tela dos dois lados pro vizinho aparecer. */
              varios ? "w-[86%] sm:w-[70%] md:w-[52%] max-w-3xl" : "w-full max-w-5xl"
            }`}
          >
            {b.imagem && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={b.imagem}
                alt={b.titulo}
                draggable={false}
                className="w-full h-40 sm:h-56 object-cover"
              />
            )}
            <div className="p-5 text-center">
              <h2 className="font-display text-xl sm:text-2xl text-cherryDark">
                {b.titulo}
              </h2>
              {b.descricao && (
                <p className="font-body text-sm text-ink/70 mt-2 max-w-md mx-auto">
                  {b.descricao}
                </p>
              )}
              {b.selo && (
                <span className="inline-block mt-3 bg-cherryDark text-white text-xs font-body font-bold uppercase tracking-wide rounded-full px-4 py-2">
                  {b.selo}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* Pontinhos: mostram em qual banner ela está e levam direto ao que
          ela tocar. Ficam com 44px de altura no toque (a área é maior que a
          bolinha) pra caber o dedo sem errar o vizinho. */}
      {varios && (
        <div className="flex justify-center items-center gap-1 mt-2">
          {banners.map((b, i) => (
            <button
              key={b.id}
              type="button"
              onClick={() => irPara(i)}
              aria-label={`Ver o destaque ${i + 1} de ${banners.length}`}
              aria-current={i === atual}
              className="flex items-center justify-center w-8 h-11 group"
            >
              <span
                className={`block rounded-full transition-all ${
                  i === atual
                    ? "w-2.5 h-2.5 bg-cherryDark"
                    : "w-2 h-2 bg-cherryLight group-hover:bg-cherryMid"
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
