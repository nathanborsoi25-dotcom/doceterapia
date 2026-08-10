"use client";

import { reais } from "@/lib/formato";
import { taxaMercadoPago } from "@/lib/taxas-mp";

/**
 * Quanto sobra de verdade em cada unidade vendida.
 *
 * A conta que a Camily fazia de cabeça era "preço menos custo", e ela
 * esquecia da mordida do Mercado Pago — que no crédito é quase 5%. Aqui os
 * dois cenários aparecem lado a lado, porque a diferença entre receber no Pix
 * e no cartão é justamente o que sustenta a ideia de dar desconto para o Pix.
 *
 * O frete não entra: aqui é o doce, e o frete vai inteiro para o entregador.
 */
export default function SobraPorUnidade({
  preco,
  custo,
}: {
  preco: number;
  custo: number;
}) {
  // Sem preço ou sem custo lançado a conta não diz nada — e o campo de custo
  // já fica âmbar avisando que falta preencher.
  if (preco <= 0 || custo <= 0) return null;

  const noPix = preco - custo - taxaMercadoPago("pix", preco);
  const noCredito = preco - custo - taxaMercadoPago("credito", preco);
  const apertado = noCredito <= 0;

  return (
    <p
      className={`text-xs font-body rounded-lg px-3 py-2 border ${
        apertado
          ? "bg-cherryDark/5 border-cherryDark/30 text-cherryDark"
          : "bg-white/60 border-cherryLight/30 text-ink/60"
      }`}
    >
      Sobra por unidade, já tirando a taxa do Mercado Pago:{" "}
      <strong className="text-ink/80">{reais(noPix)}</strong> no Pix ·{" "}
      <strong className="text-ink/80">{reais(noCredito)}</strong> no crédito.
      {apertado && " Nesse preço o cartão não paga nem o custo."}
    </p>
  );
}
