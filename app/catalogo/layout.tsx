import type { Metadata } from "next";

/**
 * Título e descrição próprios do cardápio.
 *
 * A tela é `"use client"` e não pode exportar `metadata` — por isso ele mora
 * aqui, no layout. Sem isto, cardápio, promoções e perfil da loja saíam todos
 * com o mesmo título do site, e o Google lê páginas de título igual como
 * conteúdo repetido.
 */
export const metadata: Metadata = {
  title: "Cardápio de doces artesanais em Arapongas — Doceterapia",
  description:
    "Tortas, bolos e brownies feitos à mão pela Camily Vilasboa. Peça pelo site com entrega em Arapongas-PR ou retirada combinada.",
  alternates: { canonical: "/catalogo" },
  openGraph: {
    title: "Cardápio de doces artesanais em Arapongas — Doceterapia",
    description:
      "Tortas, bolos e brownies feitos à mão pela Camily Vilasboa, em Arapongas-PR.",
  },
};

export default function LayoutDoCatalogo({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
