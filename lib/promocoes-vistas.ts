"use client";

/**
 * Quando esta pessoa viu a tela de promoções pela última vez.
 *
 * Fica no NAVEGADOR, e não no banco como o aviso dos pedidos, porque a tela
 * de promoções é pública: quem chega pelo Instagram sem conta também precisa
 * ver que tem novidade lá. Guardar no banco exigiria conta, e conta é
 * justamente o que essa pessoa ainda não tem.
 *
 * A troco disso, o aviso não acompanha entre aparelhos — o que é aceitável:
 * ver de novo um banner que já viu no outro celular não custa nada a ninguém.
 */

const CHAVE = "dt_promocoes_vistas";

/** Tem coisa nova em Promoções desde a última visita? */
export function temPromocaoNova(promocoesEm?: string | null): boolean {
  if (!promocoesEm) return false;
  const mudouEm = new Date(promocoesEm).getTime();
  if (!Number.isFinite(mudouEm)) return false;

  try {
    const visto = Number(localStorage.getItem(CHAVE));
    // Nunca abriu a tela: o que existe lá é novo pra ela.
    if (!visto) return true;
    return mudouEm > visto;
  } catch {
    // Navegador com armazenamento bloqueado: sem aviso, em vez de avisar
    // sempre — uma bolinha que nunca apaga vira sujeira na tela.
    return false;
  }
}

/** "Já vi" — chamado quando a tela de promoções abre. */
export function marcarPromocoesVistas(): void {
  try {
    localStorage.setItem(CHAVE, String(Date.now()));
  } catch {
    // Sem armazenamento, o aviso simplesmente não aparece; nada a fazer.
  }
}
