"use client";

import { useCallback, useEffect, useState } from "react";

export type Aviso = { tipo: "salvo" | "erro"; texto: string } | null;

/**
 * O aviso de "salvou" das telas do painel.
 *
 * A Camily mexia num preço, apertava salvar e a tela não dizia nada — ela
 * ficava sem saber se tinha gravado, e salvava de novo por via das dúvidas.
 * O `alert()` que algumas telas usavam resolvia isso, mas trava a tela e
 * exige um toque a mais só para dizer "ok".
 *
 * O aviso de sucesso some sozinho; o de erro FICA, porque erro que some antes
 * de ser lido é erro que ninguém corrige.
 */
export function useAvisoSalvo(segundos = 4) {
  const [aviso, setAviso] = useState<Aviso>(null);

  useEffect(() => {
    if (aviso?.tipo !== "salvo") return;
    const t = setTimeout(() => setAviso(null), segundos * 1000);
    return () => clearTimeout(t);
  }, [aviso, segundos]);

  const avisarSalvo = useCallback(
    (texto = "Prontinho, salvei aqui. 🍒") => setAviso({ tipo: "salvo", texto }),
    []
  );
  const avisarErro = useCallback(
    (texto = "Não consegui salvar agora. Confira sua internet e tente de novo.") =>
      setAviso({ tipo: "erro", texto }),
    []
  );
  const limparAviso = useCallback(() => setAviso(null), []);

  return { aviso, avisarSalvo, avisarErro, limparAviso };
}
