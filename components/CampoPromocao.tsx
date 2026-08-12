"use client";

import CampoNumero from "./CampoNumero";
import { reais } from "@/lib/formato";

/**
 * O preço de promoção, no painel.
 *
 * Fica separado do preço normal de propósito: são duas ideias diferentes, e
 * juntá-los na mesma linha faria a Camily trocar um pelo outro sem perceber —
 * o erro mais caro que essa tela pode causar.
 *
 * Enquanto o campo estiver preenchido, o doce está em oferta. Apagar tira a
 * promoção; não há data de validade.
 */
export default function CampoPromocao({
  preco,
  promocional,
  onChange,
  compacto = false,
}: {
  preco: number;
  promocional: number | null;
  onChange: (valor: number | null) => void;
  /** Versão menor, para dentro do editor de recheios. */
  compacto?: boolean;
}) {
  const ligada = promocional != null && promocional > 0;
  // Erro de digitação que sairia caro: promoção maior que o preço normal
  // cobraria MAIS de quem veio pela oferta.
  const acimaDoPreco = ligada && preco > 0 && promocional >= preco;
  const economia = ligada && !acimaDoPreco ? preco - promocional : 0;

  return (
    <div
      className={`grid gap-1.5 rounded-xl border px-3 py-2.5 ${
        ligada
          ? "bg-cherryDark/5 border-cherryDark/30"
          : "bg-white/40 border-cherryLight/30"
      }`}
    >
      <label className="grid gap-0.5">
        <span className={`text-ink/60 ${compacto ? "text-[11px]" : "text-xs"}`}>
          🏷️ Preço de promoção (R$) — deixe vazio se não estiver em oferta
        </span>
        <CampoNumero
          valor={promocional}
          onChange={(v) => onChange(v && v > 0 ? v : null)}
          placeholder="sem promoção"
          className={`text-sm font-body bg-white/70 border rounded-lg p-2 ${
            compacto ? "w-full" : "w-full sm:w-48"
          } ${acimaDoPreco ? "border-cherryDark" : "border-cherryLight/40"}`}
        />
      </label>

      {acimaDoPreco ? (
        <p className="text-xs text-cherryDark font-semibold">
          A promoção precisa ser MENOR que {reais(preco)}. Do jeito que está, o
          site ignora e cobra o preço normal.
        </p>
      ) : ligada ? (
        <p className="text-xs text-ink/60">
          O cliente vê <span className="line-through">{reais(preco)}</span>{" "}
          <strong className="text-cherryDark">{reais(promocional)}</strong> —
          economia de {reais(economia)}. Doce em promoção não aceita cupom; o
          desconto do Pix continua valendo.
        </p>
      ) : null}
    </div>
  );
}
