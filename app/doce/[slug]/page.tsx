import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DetalheDoce from "@/components/doce/DetalheDoce";
import { buscarDocePorSlug } from "@/lib/doce";
import { fotosDoProduto } from "@/lib/fotos";
import { reais } from "@/lib/formato";

export const dynamic = "force-dynamic";

/**
 * Página do doce, com endereço próprio.
 *
 * É ela que a Camily manda no story e no WhatsApp: quem toca no link cai
 * direto neste doce, com foto grande e o botão de comprar à mão. Por isso é
 * renderizada no servidor — o link precisa abrir pronto, com a foto e o preço
 * já no HTML pra o Instagram e o Google mostrarem a prévia.
 */
export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const doce = await buscarDocePorSlug(params.slug);
  if (!doce) return { title: "Doce não encontrado — Doceterapia" };

  const { produto } = doce;
  const foto = fotosDoProduto(produto)[0];
  const descricao = `${produto.descricao} ${reais(produto.preco)}.`.trim();

  return {
    title: `${produto.nome} — Doceterapia`,
    description: descricao.slice(0, 200),
    openGraph: {
      title: `${produto.nome} — ${reais(produto.preco)}`,
      description: descricao.slice(0, 200),
      images: foto ? [foto] : undefined,
      type: "website",
    },
  };
}

export default async function PaginaDoDoce({
  params,
}: {
  params: { slug: string };
}) {
  const doce = await buscarDocePorSlug(params.slug);
  if (!doce) notFound();

  return (
    <>
      <Header />
      <main className="px-4 sm:px-6 md:px-12 pb-16 max-w-4xl mx-auto w-full">
        <Link
          href="/catalogo"
          className="inline-block font-body text-sm text-cherryDark underline py-3"
        >
          ← Voltar ao cardápio
        </Link>

        <DetalheDoce produto={doce.produto} avaliacoes={doce.avaliacoes} />
      </main>
      <Footer />
    </>
  );
}
