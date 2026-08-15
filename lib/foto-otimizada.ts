/**
 * A mesma foto, no tamanho em que ela vai aparecer.
 *
 * O cardápio baixava **5,1 MB** de imagens: duas fotos PNG de ~2 MB cada, e
 * todas muito maiores que o espaço onde aparecem — uma de 1200×1200 desenhada
 * num card de 324px, a do rodapé com 704×833 num círculo de 112px. No
 * computador isso não incomoda; no 4G, que é como quase toda cliente chega
 * pelo link do Instagram, são segundos de tela vazia antes do primeiro doce.
 *
 * Em vez de trocar todos os `<img>` por `<Image>` do Next — o que mexeria em
 * layout que já está calibrado —, esta função só troca o endereço da foto pelo
 * do otimizador que o Next já expõe. Ele redimensiona, comprime e entrega em
 * WebP para quem aceita, guardando o resultado em cache.
 *
 * ⚠️ A largura precisa estar em `deviceSizes`/`imageSizes` do
 * `next.config.js`. Valor fora da lista faz o otimizador responder 400 — e a
 * foto some da tela em vez de aparecer grande.
 */

/** As larguras que o `next.config.js` autoriza. */
export type LarguraDeFoto = 64 | 128 | 256 | 384 | 640 | 828 | 1080;

export function fotoOtimizada(
  url: string | null | undefined,
  largura: LarguraDeFoto,
  qualidade = 72
): string {
  const endereco = (url ?? "").trim();
  if (!endereco) return "";

  /*
   * Só endereço remoto passa pelo otimizador. `data:` e `blob:` são a prévia
   * local de quem acabou de escolher uma foto no painel — mandá-los pra lá
   * quebraria a prévia antes mesmo de a foto existir no servidor.
   */
  if (!/^https?:\/\//i.test(endereco)) return endereco;

  return `/_next/image?url=${encodeURIComponent(endereco)}&w=${largura}&q=${qualidade}`;
}

/**
 * O tamanho certo para cada lugar onde a foto aparece.
 *
 * Já é o dobro do tamanho exibido, para a foto continuar nítida em tela de
 * celular (que desenha dois pixels para cada ponto da tela).
 */
export const TAMANHO = {
  /** Card do cardápio: ~324px de largura. */
  card: 640,
  /** Banner do topo: ~606px. */
  banner: 828,
  /** Foto grande do doce aberto. */
  detalhe: 828,
  /** Miniatura da galeria, do carrinho e do recheio: 56–112px. */
  miniatura: 256,
  /** Retrato da Camily no rodapé: 112px. */
  rodape: 256,
} as const;
