"use client";

import { useRef, useState } from "react";
import { enviarFotoProduto } from "@/lib/api";

const MAXIMO = 3;

/**
 * Galeria de fotos do doce, no painel: até três, na ordem em que a Camily
 * quiser mostrar.
 *
 * A **primeira** é a que vai pro cardápio — por isso ela ganha o selo "capa"
 * e existe o botão de promover qualquer outra a capa. Sem isso, trocar a foto
 * principal exigiria remover e enviar tudo de novo.
 */
export default function GaleriaFotos({
  fotos,
  onChange,
}: {
  fotos: string[];
  onChange: (fotos: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const lista = fotos.filter(Boolean).slice(0, MAXIMO);
  const cheio = lista.length >= MAXIMO;

  async function adicionar(e: React.ChangeEvent<HTMLInputElement>) {
    const escolhidas = Array.from(e.target.files ?? []);
    if (escolhidas.length === 0) return;

    setErro("");
    setEnviando(true);
    try {
      const cabem = escolhidas.slice(0, MAXIMO - lista.length);
      const enviadas: string[] = [];
      for (const arquivo of cabem) {
        enviadas.push(await enviarFotoProduto(arquivo));
      }
      onChange([...lista, ...enviadas].slice(0, MAXIMO));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar a foto.");
    } finally {
      setEnviando(false);
      // Limpa pra dar pra escolher o mesmo arquivo de novo.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function remover(url: string) {
    onChange(lista.filter((f) => f !== url));
  }

  function virarCapa(url: string) {
    onChange([url, ...lista.filter((f) => f !== url)]);
  }

  return (
    <div className="grid gap-2">
      <span className="text-sm font-body text-ink/80">
        Fotos do doce{" "}
        <span className="text-ink/45">
          ({lista.length} de {MAXIMO})
        </span>
      </span>

      <div className="flex flex-wrap gap-3">
        {lista.map((url, i) => (
          <div key={url} className="grid gap-1">
            <div
              className={`relative w-24 h-24 rounded-xl overflow-hidden bg-blush border ${
                i === 0 ? "border-cherryDark border-2" : "border-cherryLight/40"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={i === 0 ? "Foto de capa do doce" : `Foto ${i + 1} do doce`}
                className="w-full h-full object-cover"
              />
              {i === 0 && (
                <span className="absolute bottom-0 inset-x-0 bg-cherryDark text-white text-[10px] font-body font-semibold text-center py-0.5">
                  capa
                </span>
              )}
            </div>

            <div className="flex gap-1 justify-center">
              {i !== 0 && (
                <button
                  type="button"
                  onClick={() => virarCapa(url)}
                  className="text-[11px] font-body text-cherryDark underline py-2 px-1"
                >
                  usar de capa
                </button>
              )}
              <button
                type="button"
                onClick={() => remover(url)}
                className="text-[11px] font-body text-ink/50 underline py-2 px-1"
              >
                remover
              </button>
            </div>
          </div>
        ))}

        {!cheio && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={enviando}
            className="w-24 h-24 rounded-xl border-2 border-dashed border-cherryLight/60 text-cherryDark font-body text-xs flex flex-col items-center justify-center gap-1 hover:bg-blush/40 disabled:opacity-50"
          >
            <span className="text-2xl leading-none">+</span>
            {enviando ? "enviando..." : lista.length === 0 ? "escolher foto" : "mais uma"}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={adicionar}
        className="hidden"
      />

      {erro ? (
        <span className="text-xs text-cherryDark">{erro}</span>
      ) : (
        <span className="text-xs text-ink/50">
          A primeira é a que aparece no cardápio; as outras o cliente vê ao abrir
          o doce. Da galeria do celular ou do computador, até 8 MB cada.
        </span>
      )}
    </div>
  );
}
