import type { Metadata } from "next";

/**
 * O painel usa o manifesto DELE, não o da loja.
 *
 * As telas do painel são todas `"use client"` e não podem exportar
 * `metadata` — por isso isto mora aqui, valendo para `/admin` inteiro. O
 * `title` também muda: com o atalho na tela de início, o nome que aparece
 * embaixo do ícone sai daqui, e "Doceterapia" apareceria duas vezes na tela
 * dela, sem dizer qual é qual.
 */
export const metadata: Metadata = {
  title: "Painel Doceterapia",
  manifest: "/painel.webmanifest",
  icons: {
    icon: [{ url: "/icone-painel.png", sizes: "512x512", type: "image/png" }],
    // O iPhone ignora o manifesto e usa ESTE ícone ao adicionar à tela de
    // início — sem ele o atalho do painel sairia com a mesma logo da loja.
    apple: [{ url: "/icone-painel.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, title: "Painel", statusBarStyle: "default" },
  robots: { index: false, follow: false },
};

export default function LayoutDoPainel({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
