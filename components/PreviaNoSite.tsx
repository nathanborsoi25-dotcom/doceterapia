"use client";

/**
 * Como a imagem vai aparecer no site, mostrado ANTES de salvar.
 *
 * A Camily subia a foto, salvava, saía do painel, abria o cardápio — e só ali
 * descobria que o doce tinha ficado com a borda cortada ou que o texto da arte
 * do banner sumiu na dobra. Aqui ela vê o recorte de verdade, no tamanho de
 * verdade, enquanto ainda dá pra trocar a imagem.
 *
 * O recorte é o mesmo do site porque usa as MESMAS classes: proporção 4/3 e o
 * arco no card do doce, 2/1 no banner. Se um dia o card mudar de formato, esta
 * prévia precisa mudar junto — é o preço de mostrar a verdade.
 */
export default function PreviaNoSite({
  url,
  formato,
}: {
  url: string;
  formato: "doce" | "banner";
}) {
  if (!url) return null;

  const ehDoce = formato === "doce";

  return (
    <div className="grid gap-1.5">
      <span className="text-[11px] font-body uppercase tracking-wide text-ink/45">
        Como vai ficar no site
      </span>

      <div
        className={
          ehDoce
            ? // O card do cardápio: largura de celular, arco em cima.
              "w-full max-w-[220px] bg-white/70 rounded-t-[999px] rounded-br-3xl rounded-bl-md border border-cherryLight/30 overflow-hidden"
            : "w-full max-w-sm rounded-2xl border border-cherryLight/40 overflow-hidden bg-blush/60"
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="Prévia de como a imagem aparece no site"
          className={`w-full object-cover ${
            ehDoce ? "aspect-[4/3] rounded-t-[999px]" : "aspect-[2/1]"
          }`}
        />
        {ehDoce && (
          /* Um pedaço do card por baixo, pra ela ver a foto no contexto e não
             como um retângulo solto. */
          <div className="p-3">
            <div className="h-2.5 w-3/4 rounded-full bg-cherryLight/40" />
            <div className="h-2 w-1/2 rounded-full bg-cherryLight/25 mt-2" />
          </div>
        )}
      </div>

      <span className="text-xs text-ink/50">
        {ehDoce
          ? "O card corta em cima e embaixo — deixe o doce no meio da foto. Suba quadrada, 1080 × 1080 px."
          : "No celular o banner aparece com 322 × 161 px e os vizinhos espiam nas laterais — deixe o texto longe das bordas. Arte em 1080 × 540 px."}
      </span>
    </div>
  );
}
