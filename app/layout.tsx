import type { Metadata, Viewport } from "next";
import BarraInferior from "@/components/BarraInferior";
import "./globals.css";

export const metadata: Metadata = {
  title: "Doceterapia | Doces artesanais em Arapongas",
  description:
    "Peça online os doces artesanais da Camily Vilasboa. Entrega e retirada agendadas em Arapongas, PR.",
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
