import type { MetadataRoute } from "next";

/**
 * O que faz o site poder virar ícone na tela de início do celular.
 *
 * Quase todo mundo chega pela bio do Instagram, e o caminho de volta é sempre
 * o mesmo: abrir o Instagram, achar o perfil, tocar no link. Com o site na
 * tela de início, a segunda compra começa a um toque da mesma tela onde a
 * pessoa já está.
 *
 * `display: standalone` tira a barra de endereço — o site abre como aplicativo.
 * `start_url` vai direto pro cardápio porque a raiz só redireciona pra lá.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Doceterapia — doces artesanais da Camily",
    short_name: "Doceterapia",
    description:
      "Peça os doces artesanais da Camily Vilasboa. Entrega e retirada em Arapongas, PR.",
    start_url: "/catalogo",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FDF0EA",
    theme_color: "#FDF0EA",
    lang: "pt-BR",
    categories: ["food", "shopping"],
    icons: [
      { src: "/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // `maskable` avisa o Android de que a arte já tem margem de sobra, então
      // ele pode recortar no formato do sistema sem comer a cereja.
      {
        src: "/icone-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Cardápio", url: "/catalogo" },
      { name: "Promoções", url: "/promocoes" },
      { name: "Meus pedidos", url: "/conta" },
    ],
  };
}
