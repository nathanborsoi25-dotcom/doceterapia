import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Doceterapia | Doces artesanais em Arapongas",
  description:
    "Peça online os doces artesanais da Camily Vilasboa. Entrega e retirada agendadas em Arapongas, PR.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
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
      <body className="font-body">{children}</body>
    </html>
  );
}
