import type { Metadata } from "next";
import { IMAGEM_PREVIA } from "@/lib/site";

export const metadata: Metadata = {
  title: "Promoções, cupons e pontos — Doceterapia",
  description:
    "Os doces em oferta, os cupons de desconto e o programa de pontos da Doceterapia. Pagando no Pix você ainda ganha desconto.",
  alternates: { canonical: "/promocoes" },
  openGraph: {
    title: "Promoções e cupons — Doceterapia",
    description:
      "Doces em oferta, cupons e pontos que viram prêmio. Com desconto no Pix.",
    images: [IMAGEM_PREVIA],
  },
};

export default function LayoutDasPromocoes({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
