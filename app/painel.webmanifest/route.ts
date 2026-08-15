import type { MetadataRoute } from "next";

/**
 * O manifesto do PAINEL — o que faz o atalho da Camily abrir o painel dela, e
 * não o cardápio.
 *
 * Por que um segundo manifesto: o da loja (`app/manifest.ts`) tem
 * `start_url: /catalogo`. Se o painel usasse o mesmo, o ícone que ela põe na
 * tela de início abriria a loja e ela teria que navegar até `/admin` toda vez
 * — que é exatamente o trabalho que o atalho existe para evitar.
 *
 * `id` e `scope` próprios são o que faz o Android tratar os dois como
 * aplicativos separados: sem eles, instalar um substituiria o outro.
 *
 * É uma rota (e não um arquivo em `public/`) para garantir o tipo
 * `application/manifest+json` — servido como texto comum, o navegador ignora
 * o arquivo em silêncio, e "o atalho abriu a loja" é um bug difícil de achar.
 */
const manifesto: MetadataRoute.Manifest = {
  id: "/admin",
  name: "Painel Doceterapia",
  short_name: "Painel",
  description: "Os pedidos, o cardápio e os números da Doceterapia.",
  start_url: "/admin",
  scope: "/admin",
  display: "standalone",
  orientation: "portrait",
  background_color: "#FDF0EA",
  theme_color: "#8C1D2B",
  lang: "pt-BR",
  icons: [
    { src: "/icone-painel.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icone-painel.png", sizes: "512x512", type: "image/png", purpose: "any" },
    // O desenho já nasce com a folga que o Android come ao recortar no
    // formato do sistema — o disco fica no meio, com margem de sobra.
    { src: "/icone-painel.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
  shortcuts: [
    { name: "Pedidos", url: "/admin/pedidos" },
    { name: "Meus números", url: "/admin/metricas" },
    { name: "Produtos", url: "/admin/produtos" },
  ],
};

export function GET() {
  return Response.json(manifesto, {
    headers: {
      "content-type": "application/manifest+json",
      // Área dela: fora do índice do Google, como o resto de /admin.
      "x-robots-tag": "noindex",
    },
  });
}
