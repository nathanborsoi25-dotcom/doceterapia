"use client";

import { useState } from "react";
import VoltarAoPainel from "@/components/VoltarAoPainel";

/**
 * O site do jeito que a cliente vê, dentro do painel.
 *
 * A Camily mexia num preço, numa foto ou numa promoção e não tinha como
 * conferir o resultado sem sair do painel, abrir o site em outra aba e achar
 * o doce de novo. No celular — que é de onde ela mexe — isso é trocar de aba
 * ida e volta a cada ajuste.
 *
 * É um `iframe` do site DE VERDADE, e não uma cópia das telas: cópia começa
 * igual e envelhece. O dia em que o card do doce mudar, isto muda junto,
 * porque é o mesmo site.
 *
 * A moldura tem 375px, a largura do iPhone mais comum — é como quase toda
 * cliente chega, pelo link da bio do Instagram.
 */

const TELAS = [
  { id: "catalogo", caminho: "/catalogo", nome: "Cardápio" },
  { id: "promocoes", caminho: "/promocoes", nome: "Promoções" },
  { id: "loja", caminho: "/loja", nome: "Perfil da loja" },
  { id: "carrinho", caminho: "/carrinho", nome: "Carrinho" },
] as const;

export default function AdminCardapioPage() {
  const [tela, setTela] = useState<(typeof TELAS)[number]>(TELAS[0]);
  /**
   * Muda a cada toque em "Atualizar" e a cada troca de tela.
   *
   * Vai na URL como `?v=` porque apontar o iframe pro MESMO endereço não
   * recarrega nada — o navegador entende que já está lá. Sem isso, o botão de
   * atualizar não faria absolutamente nada depois de salvar um preço.
   */
  const [versao, setVersao] = useState(() => Date.now());

  function abrir(nova: (typeof TELAS)[number]) {
    setTela(nova);
    setVersao(Date.now());
  }

  const endereco = `${tela.caminho}?previa=${versao}`;

  return (
    <main className="min-h-screen px-4 sm:px-6 md:px-12 py-8 md:py-10 max-w-3xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl sm:text-3xl text-cherryDark">
          Ver meu site
        </h1>
        <VoltarAoPainel />
      </div>

      <p className="font-body text-sm text-ink/65 mt-2">
        É o site de verdade, do jeitinho que a cliente vê no celular dela.
        Mexeu em alguma coisa? Toque em <strong>Atualizar</strong> pra conferir
        aqui mesmo.
      </p>

      {/* Fileira de telas: rola de lado no celular, quebra linha em tela
          grande — senão os últimos somem sem nenhuma pista. */}
      <div className="flex gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible -mx-4 px-4 sm:mx-0 sm:px-0 mt-5">
        {TELAS.map((t) => {
          const ativa = t.id === tela.id;
          return (
            <button
              key={t.id}
              onClick={() => abrir(t)}
              aria-current={ativa ? "true" : undefined}
              className={`shrink-0 px-4 py-2.5 rounded-full text-sm font-body border transition-colors ${
                ativa
                  ? "bg-cherryDark text-white border-cherryDark font-semibold"
                  : "bg-white/70 text-ink/70 border-cherryLight/50 hover:border-cherryDark"
              }`}
            >
              {t.nome}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4">
        <button
          onClick={() => setVersao(Date.now())}
          className="font-body text-sm text-cherryDark underline inline-flex items-center min-h-[44px]"
        >
          Atualizar
        </button>
        <a
          href={tela.caminho}
          target="_blank"
          rel="noopener noreferrer"
          className="font-body text-sm text-ink/60 underline inline-flex items-center min-h-[44px]"
        >
          Abrir o site em outra aba
        </a>
      </div>

      {/* A moldura: largura de celular, cantos arredondados e uma sombra
          suave, pra ficar claro que ali dentro é o site e não mais painel. */}
      <div className="mt-2 flex justify-center">
        <div className="w-full max-w-[375px] rounded-[28px] border-4 border-ink/15 overflow-hidden bg-cream shadow-lg">
          <iframe
            key={endereco}
            src={endereco}
            title="Prévia do site como a cliente vê"
            className="w-full h-[640px] block"
          />
        </div>
      </div>

      <p className="font-body text-xs text-ink/45 text-center mt-3">
        Dentro dessa telinha o site funciona de verdade — dá pra rolar, abrir
        um doce e conferir o preço.
      </p>
    </main>
  );
}
