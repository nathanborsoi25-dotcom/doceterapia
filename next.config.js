/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
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
};

module.exports = nextConfig;
