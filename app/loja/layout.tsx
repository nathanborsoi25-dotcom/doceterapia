import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Onde buscar, horários e formas de pagamento — Doceterapia",
  description:
    "Quem faz os doces, os endereços de retirada em Arapongas, o horário de entrega e as formas de pagamento aceitas pela Doceterapia.",
  alternates: { canonical: "/loja" },
  openGraph: {
    title: "Perfil da loja — Doceterapia",
    description:
      "Endereços de retirada, horário de entrega e formas de pagamento da Doceterapia, em Arapongas-PR.",
  },
};

export default function LayoutDaLoja({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
