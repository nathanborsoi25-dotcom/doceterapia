/**
 * O endereço da loja, num lugar só.
 *
 * Estava escrito à mão em cada arquivo que precisava dele (metadata, e-mail,
 * sitemap), e endereço repetido é endereço que um dia diverge.
 */
export const SITE = "https://doceterapia.net.br";

/**
 * A figura que aparece quando alguém manda um link do site no WhatsApp.
 *
 * Mora aqui porque **cada tela que declara `openGraph` precisa repeti-la**: o
 * Next troca o bloco inteiro pelo da tela filha, não mistura com o do site.
 * O cardápio declarava só título e descrição — e ficava sem imagem nenhuma,
 * logo na tela que o endereço da bio abre.
 *
 * Desenhada por `scripts/gerar-og.mjs`.
 */
export const IMAGEM_PREVIA = {
  url: "/og.jpg",
  width: 1200,
  height: 630,
  alt: "Doceterapia — doces artesanais em Arapongas-PR",
};
