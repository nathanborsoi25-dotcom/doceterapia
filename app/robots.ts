import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/**
 * O que o Google pode visitar.
 *
 * Antes disto o arquivo não existia (404), e o buscador ficava sem instrução
 * nenhuma — inclusive livre para tentar indexar o painel e as telas de conta.
 *
 * O bloqueio aqui é de RASTREIO, não de segurança: quem protege o painel é o
 * middleware, que exige sessão. Isto só evita que essas páginas apareçam em
 * busca e que o robô gaste visita com tela que ninguém procura no Google.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/admin/",
        "/api/",
        "/conta",
        "/checkout",
        "/carrinho",
        "/pedido/",
        "/entrar",
        "/cadastro",
        "/esqueci-senha",
        "/redefinir-senha",
      ],
    },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
