"use client";

import { useEffect, useState } from "react";
import { limparNumeroDigitado, numeroDigitado, numeroParaCampo } from "@/lib/formato";

/**
 * Caixa de digitar número do jeito brasileiro (preço, custo, frete, pontos).
 *
 * Por que não é um <input type="number">: naquele, digitar vírgula faz o
 * navegador devolver texto vazio, e o campo apagava sozinho o que a Camily
 * estava escrevendo. Aqui o campo guarda o TEXTO enquanto ela digita e só
 * converte pra número no fim — então dá pra apagar tudo, digitar "6," e
 * continuar com os centavos numa boa.
 *
 * Manda `null` pro pai quando o campo está vazio, pra ele decidir o que isso
 * significa (na maioria das telas, zero).
 */
export default function CampoNumero({
  valor,
  onChange,
  casas = 2,
  placeholder,
  className,
  required,
  id,
  inputRef,
  "aria-label": ariaLabel,
}: {
  valor: number | null | undefined;
  onChange: (valor: number | null) => void;
  /** Casas depois da vírgula. Use 0 em campos que só aceitam inteiro. */
  casas?: number;
  placeholder?: string;
  className?: string;
  required?: boolean;
  id?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  "aria-label"?: string;
}) {
  const [texto, setTexto] = useState(() => numeroParaCampo(valor));

  // Só reescreve o campo quando o valor muda POR FORA (ex: os dados
  // chegaram do banco). Comparar tratando vazio como zero é o que impede o
  // campo de se reencher sozinho quando a Camily apaga tudo.
  useEffect(() => {
    if ((numeroDigitado(texto) ?? 0) !== (valor ?? 0)) {
      setTexto(numeroParaCampo(valor));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  return (
    <input
      id={id}
      ref={inputRef}
      type="text"
      // Abre o teclado numérico no celular, sem a validação do type="number".
      inputMode={casas > 0 ? "decimal" : "numeric"}
      value={texto}
      required={required}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={className}
      onChange={(e) => {
        const limpo = limparNumeroDigitado(e.target.value, casas);
        setTexto(limpo);
        onChange(numeroDigitado(limpo));
      }}
      // Ao sair do campo, deixa o número arrumado ("6," vira "6").
      onBlur={() => setTexto(numeroParaCampo(numeroDigitado(texto)))}
    />
  );
}
