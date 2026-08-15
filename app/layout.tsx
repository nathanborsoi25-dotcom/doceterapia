import type { Metadata, Viewport } from "next";
import BarraInferior from "@/components/BarraInferior";
import { IMAGEM_PREVIA, SITE } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  title: "Doceterapia | Doces artesanais em Arapongas",
  description:
    "Peça online os doces artesanais da Camily Vilasboa. Entrega e retirada agendadas em Arapongas, PR.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/logo.png", sizes: "512x512", type: "image/png" }],
    // O iPhone ignora o manifest e usa ESTE ícone quando alguém adiciona o
    // site à tela de início. Sem ele, o atalho vira um retrato borrado da
    // página — que é o que aconteceria com a maior parte das clientes.
    apple: [{ url: "/logo.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Doceterapia",
    statusBarStyle: "default",
  },
  /*
   * A cara do link quando alguém manda o site no WhatsApp ou no Instagram, e
   * a miniatura no Google. Sem isto o compartilhamento sai com um retângulo
   * vazio — e o link da bio é justamente por onde quase todo mundo chega.
   */
  metadataBase: new URL(SITE),
  // O endereço oficial de cada tela, pra o Google não tratar o mesmo conteúdo
  // aberto com `?v=`, `?utm_source=` etc. como páginas diferentes.
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Doceterapia",
    title: "Doceterapia | Doces artesanais em Arapongas",
    description:
      "Peça online os doces artesanais da Camily Vilasboa. Entrega e retirada em Arapongas, PR.",
    /*
     * 1200×630 é a medida que o WhatsApp e o Instagram usam pra mostrar o
     * cartão GRANDE, com foto. A logo quadrada de 512 caía no cartãozinho de
     * lado, e quem recebia o link não via doce nenhum. Desenhada por
     * `scripts/gerar-og.mjs` — rode-o de novo se trocar o doce da vitrine.
     */
    images: [IMAGEM_PREVIA],
  },
  twitter: {
    card: "summary_large_image",
    title: "Doceterapia | Doces artesanais em Arapongas",
    description: "Os doces artesanais da Camily Vilasboa, em Arapongas-PR.",
    images: ["/og.jpg"],
  },
};

/**
 * O site é aberto quase sempre pelo celular (link na bio do Instagram).
 * `viewportFit: cover` cuida da área do notch/barra inferior dos iPhones,
 * e não travamos o zoom — quem precisa aumentar a letra consegue.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fdf0ea",
};

/**
 * `gaveta` é a fatia extra do layout onde o doce aberto por dentro do
 * cardápio aparece (ver `app/@gaveta`). Nas telas em que ninguém abriu um
 * doce ela renderiza nada.
 */
export default function RootLayout({
  children,
  gaveta,
}: {
  children: React.ReactNode;
  gaveta: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Nunito:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      {/*
        O `pb` deixa livre a faixa que a barra fixa do rodapé ocupa. Sem ele,
        a barra cobre o último botão de cada tela — e o último botão costuma
        ser justamente o de finalizar alguma coisa.
      */}
      <body className="font-body pb-[calc(64px+env(safe-area-inset-bottom))]">
        {children}
        {gaveta}
        <BarraInferior />
      </body>
    </html>
  );
}
