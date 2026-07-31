"use client";

import { useRef, useState } from "react";
import { enviarFotoProduto } from "@/lib/api";

/**
 * Campo de foto do produto: a Camily escolhe da galeria do celular ou de uma
 * pasta do computador, a imagem sobe na hora e o endereço dela volta pronto
 * pra salvar no produto. Substituiu o antigo campo de colar URL, que era
 * inviável de usar no dia a dia.
 */
export default function EscolherFoto({
  valor,
  onChange,
}: {
  valor: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  async function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    setErro("");
    setEnviando(true);
    try {
      onChange(await enviarFotoProduto(arquivo));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar a foto.");
    } finally {
      setEnviando(false);
      // Limpa o campo pra dar pra escolher o mesmo arquivo de novo.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-2">
      <span className="text-sm font-body text-ink/80">Foto do doce</span>

      <div className="flex items-center gap-3">
        {/* Miniatura do que está salvo, pra ela ver o que o cliente vai ver */}
        <div className="w-20 h-20 shrink-0 rounded-xl bg-blush border border-cherryLight/40 overflow-hidden flex items-center justify-center text-2xl">
          {valor ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={valor} alt="Foto do doce" className="w-full h-full object-cover" />
          ) : (
            "🍰"
          )}
        </div>

        <div className="grid gap-2 min-w-0">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={enviando}
            className="text-sm font-body bg-cherryDark text-white rounded-full px-4 py-2.5 font-semibold disabled:opacity-50"
          >
            {enviando
              ? "Enviando foto..."
              : valor
                ? "Trocar foto"
                : "Escolher foto"}
          </button>

          {valor && !enviando && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="text-xs font-body text-ink/50 underline text-left py-1"
            >
              Remover foto
            </button>
          )}
        </div>
      </div>

      {/* accept + capture fazem o celular abrir direto a galeria/câmera */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={escolher}
        className="hidden"
      />

      {erro ? (
        <span className="text-xs text-cherryDark">{erro}</span>
      ) : (
        <span className="text-xs text-ink/50">
          Escolha da galeria do celular ou do computador. Até 8 MB.
        </span>
      )}
    </div>
  );
}
