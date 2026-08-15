/**
 * O símbolo do Instagram (a câmera de contorno).
 *
 * Mesmo arranjo do `IconeWhatsApp`: a cor vem de fora, por classe de texto,
 * porque ele aparece branco sobre o botão colorido do perfil da loja e no rosa
 * da marca sobre o fundo claro do rodapé.
 *
 * Desenhado com formas simples — retângulo, círculo e ponto — em vez de um
 * caminho copiado: forma geométrica é conferível a olho e não depende de
 * `defs` com id, que colidem quando o mesmo ícone aparece duas vezes na tela.
 */
export default function IconeInstagram({
  className = "w-5 h-5",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2.75" y="2.75" width="18.5" height="18.5" rx="5.5" />
      <circle cx="12" cy="12" r="4.25" />
      {/* A luzinha do canto: preenchida, senão vira um anel e some no tamanho pequeno. */}
      <circle cx="17.4" cy="6.6" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  );
}
