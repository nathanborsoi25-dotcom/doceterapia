/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
    /*
     * As larguras que o otimizador aceita (ver `lib/foto-otimizada.ts`).
     * Enxutas de propósito: cada tamanho gera uma versão em cache, e a loja
     * usa a foto em cinco lugares só. Pedir largura fora desta lista faz o
     * otimizador responder 400 e a foto sumir da tela.
     */
    deviceSizes: [640, 828, 1080],
    imageSizes: [64, 128, 256, 384],
    // WebP corta boa parte do peso e é aceito por todo navegador atual.
    formats: ["image/webp"],
    // As fotos ficam no Vercel Blob e não mudam de endereço; um mês de cache
    // evita reprocessar a mesma imagem a cada visita.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },

  /*
   * O preço da tela do doce não pode envelhecer no navegador.
   *
   * O Next guarda no cliente o conteúdo das telas de servidor já visitadas
   * (Router Cache) e reaproveita ao voltar nelas. Isso fez a gaveta do doce
   * mostrar R$ 16,00 enquanto o card do cardápio, ao lado, mostrava os R$ 12,00
   * da promoção — o card lê o preço por `fetch`, sempre fresco, e a gaveta vinha
   * da memória do navegador de antes da Camily pôr o doce em oferta.
   *
   * Preço divergente na mesma tela é o pior tipo de bug de loja: a cliente
   * confia no menor e a conta não fecha. `dynamic: 0` faz toda tela de servidor
   * ser buscada de novo a cada visita.
   */
  experimental: {
    staleTimes: { dynamic: 0 },
  },

  /**
   * Cabeçalhos de segurança.
   *
   * A auditoria de 15/08/2026 achou o site sem nenhum deles: dava pra embutir
   * a loja inteira num `<iframe>` de outro site e desenhar botões falsos por
   * cima (clickjacking) — num site que pede endereço e leva ao pagamento,
   * isso é o que mais preocupa.
   */
  async headers() {
    return [
      {
        source: "/:caminho*",
        headers: [
          // Ninguém embute a loja em iframe. `frame-ancestors` é a forma
          // moderna; `X-FRAME-OPTIONS` cobre navegador antigo.
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Content-Security-Policy",
            /*
             * Proposital e conservador. `unsafe-inline`/`unsafe-eval` em
             * script-src ainda são necessários: o Next injeta o payload de
             * hidratação como script inline. O que já fecha aqui é o essencial
             * — de onde podem vir scripts, a quem o site pode se conectar, e
             * quem pode embutir a página.
             */
            value: [
              "default-src 'self'",
              /*
               * O SDK do Mercado Pago é carregado do domínio deles — é ele que
               * desenha os campos do cartão e tokeniza o número SEM que o
               * número passe por aqui. `http2.mlstatic.com` é o CDN de onde o
               * SDK puxa os próprios pedaços.
               */
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://sdk.mercadopago.com https://http2.mlstatic.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://http2.mlstatic.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              // As fotos vêm do Vercel Blob; `https:` cobre o domínio dele.
              "img-src 'self' data: blob: https:",
              // O site conversa com as próprias rotas, com o Nominatim (mapa),
              // o ViaCEP e o Mercado Pago.
              /*
               * ⚠️ O Brick não busca só o script: ele baixa as TRADUÇÕES dele
               * (`i18n/pt/payment/index.json`, em http2.mlstatic.com) e manda
               * telemetria pro mercadolibre.com. Faltando qualquer um destes,
               * ele morre com "Bricks component initialization failed" e o
               * formulário fica preso em "abrindo..." — sem erro na nossa tela.
               */
              "connect-src 'self' https://nominatim.openstreetmap.org https://viacep.com.br https://api.mercadopago.com https://api.mercadolibre.com https://events.mercadopago.com https://http2.mlstatic.com https://*.mercadopago.com https://*.mercadolibre.com",
              /*
               * Os campos do cartão são iframes do Mercado Pago: é assim que o
               * número da cliente nunca encosta no nosso código. Sem esta
               * linha eles caem no `default-src 'self'` e nada aparece.
               */
              "frame-src 'self' https://*.mercadopago.com https://*.mercadolibre.com",
              "form-action 'self' https://www.mercadopago.com.br",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "object-src 'none'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
          // Impede o navegador de "adivinhar" o tipo de um arquivo.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Ao sair para o Mercado Pago, manda só o domínio — não o caminho,
          // que poderia carregar o id do pedido.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // A loja não usa câmera, microfone nem localização.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          // HSTS com subdomínios (a Vercel já mandava a versão curta).
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ],
      },
      {
        /*
         * O painel nunca pode ser guardado por cache nenhum. Ele vinha com
         * `public`, que é o padrão de página pública — e ali dentro há pedido,
         * telefone e endereço de cliente.
         */
        source: "/admin/:caminho*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
