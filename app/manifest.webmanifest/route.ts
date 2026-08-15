import type { MetadataRoute } from "next";

/**
 * ⚠️ Isto era `app/manifest.ts`, o arquivo de convenção do Next — e precisou
 * virar rota comum. A convenção injeta o `<link rel="manifest">` dela em
 * TODAS as telas do site e ignora o `manifest` declarado no metadata de cada
 * área: o painel apontava para o próprio manifesto e o link continuava vindo
 * daqui, então o atalho da Camily abriria o cardápio. Como rota, cada layout
 * declara o seu (`app/layout.tsx` este, `app/admin/layout.tsx` o do painel).
 *
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
const manifesto: MetadataRoute.Manifest = {
  // Identidade do aplicativo. É o que faz o celular entender que a loja e o
  // painel são dois atalhos diferentes, e não um substituindo o outro.
  id: "/",
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
  /*
   * A logo da loja, em arquivo único.
   *
   * Ela já é 512×512, e o navegador reduz sozinho para o tamanho de que
   * precisa — guardar três cópias recortadas só criaria três lugares para a
   * marca ficar desatualizada no dia em que ela mudar.
   */
  icons: [
    { src: "/logo.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/logo.png", sizes: "512x512", type: "image/png", purpose: "any" },
    // `maskable` avisa o Android de que a arte já tem margem de sobra — e
    // tem: o círculo creme deixa folga em volta do DT. Sem isso ele recorta
    // no formato do sistema e come as cerejas.
    { src: "/logo.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
  shortcuts: [
    { name: "Cardápio", url: "/catalogo" },
    { name: "Promoções", url: "/promocoes" },
    { name: "Meus pedidos", url: "/conta" },
  ],
};

export function GET() {
  return Response.json(manifesto, {
    headers: { "content-type": "application/manifest+json" },
  });
}
