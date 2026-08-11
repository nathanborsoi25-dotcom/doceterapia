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
          /*
           * Só a imagem. A arte já vem com o texto escrito dentro dela, e
           * repetir título e descrição embaixo dava duas mensagens dizendo a
           * mesma coisa — além de esticar o banner e empurrar os doces pra
           * fora da primeira tela do celular.
           *
           * A proporção é fixa (2:1) pra todos os banners ficarem do mesmo
           * tamanho no trilho, mesmo que a Camily suba artes diferentes.
           */
          <Link
            key={b.id}
            href={b.link || "/catalogo"}
            aria-label={b.titulo || "Ver a promoção"}
            className={`snap-center shrink-0 rounded-2xl overflow-hidden bg-blush/60 border border-cherryLight/40 hover:border-cherryDark transition-colors ${
              /* Com vários, sobra tela dos dois lados pro vizinho aparecer. */
              varios ? "w-[86%] sm:w-[70%] md:w-[52%] max-w-3xl" : "w-full max-w-3xl"
            }`}
          >
            {b.imagem ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={b.imagem}
                alt={b.titulo || "Promoção"}
                draggable={false}
                className="w-full aspect-[2/1] object-cover"
              />
            ) : (
              /* Sem imagem, o título salva o banner de ficar em branco. */
              <span className="flex items-center justify-center w-full aspect-[2/1] px-6 text-center font-display text-xl text-cherryDark">
                {b.titulo}
              </span>
            )}
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
