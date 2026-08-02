import type { Produto } from "./types";

/**
 * As fotos de um doce, em ordem, com a capa na frente.
 *
 * Existe porque os doces cadastrados antes da galeria só têm `fotoUrl`.
 * Em vez de espalhar `produto.fotos ?? [produto.fotoUrl]` por toda tela,
 * a decisão fica num lugar só.
 */
export function fotosDoProduto(produto: Pick<Produto, "fotoUrl" | "fotos">): string[] {
  const galeria = (produto.fotos ?? []).filter(Boolean);
  if (galeria.length > 0) return galeria;
  return produto.fotoUrl ? [produto.fotoUrl] : [];
}
