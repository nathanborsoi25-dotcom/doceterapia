"use client";

import { useEffect, useState } from "react";

/**
 * "Pra onde eu volto depois de entrar?"
 *
 * Quem clica em pagar sem estar logada vai pro login com ?voltar=/checkout e
 * precisa cair de volta exatamente lá, com o carrinho intacto.
 */

const PADRAO = "/catalogo";

/**
 * Só deixa passar caminho de dentro do site. Sem esta checagem,
 * `?voltar=https://site-falso.com` mandaria a cliente pra fora do site logo
 * depois de digitar a senha — que é exatamente como golpe de phishing
 * funciona.
 */
export function caminhoInternoSeguro(valor: string | null | undefined): string {
  if (typeof valor !== "string") return PADRAO;
  if (!valor.startsWith("/") || valor.startsWith("//")) return PADRAO;
  return valor;
}

export function useDestinoDeVolta(): string {
  // Começa no padrão e ajusta depois de montar: ler a URL durante a
  // renderização faria o servidor e o navegador desenharem coisas diferentes.
  const [destino, setDestino] = useState(PADRAO);

  useEffect(() => {
    const parametro = new URLSearchParams(window.location.search).get("voltar");
    setDestino(caminhoInternoSeguro(parametro));
  }, []);

  return destino;
}
