import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DetalheDoce from "@/components/doce/DetalheDoce";
import { buscarDocePorSlug } from "@/lib/doce";
import { fotosDoProduto } from "@/lib/fotos";
import { reais } from "@/lib/formato";
import { precoAPagar, precoCheio } from "@/lib/promocao";
import { SITE } from "@/lib/site";
import type { Produto } from "@/lib/types";

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

  /*
   * ⚠️ O preço do compartilhamento é o que a cliente PAGA, não o de tabela.
   *
   * Aqui usava `produto.preco`, e o resultado aparecia justamente onde mais
   * dói: a Camily mandava o doce no story anunciando R$ 16,00 enquanto o site
   * cobrava R$ 12,00 pela promoção. A oferta existe pra ganhar o clique, e era
   * no clique que ela sumia.
   */
  const nome = produto.nome.trim();
  const aPagar = precoAPagar(produto);
  const cheio = precoCheio(produto);
  const emOferta = aPagar < cheio;

  const precoEscrito = emOferta
    ? `${reais(aPagar)} (de ${reais(cheio)})`
    : reais(aPagar);
  const descricao = `${produto.descricao} ${precoEscrito}.`.trim();

  return {
    title: `${nome} — Doceterapia`,
    description: descricao.slice(0, 200),
    alternates: { canonical: `/doce/${params.slug}` },
    openGraph: {
      title: `${nome} — ${precoEscrito}`,
      description: descricao.slice(0, 200),
      images: foto ? [foto] : undefined,
      type: "website",
    },
  };
}

/**
 * Os dados do doce em formato de máquina, pro Google mostrar preço e
 * disponibilidade direto no resultado da busca.
 *
 * `offers.price` leva o preço que ela paga de verdade — o mesmo critério do
 * compartilhamento. Anunciar um preço na busca e cobrar outro no site é o tipo
 * de divergência que o próprio Google penaliza.
 */
function dadosEstruturados(produto: Produto, slug: string) {
  const aPagar = precoAPagar(produto);
  const temEstoque = produto.estoque == null || produto.estoque > 0;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: produto.nome.trim(),
    description: produto.descricao,
    image: fotosDoProduto(produto),
    brand: { "@type": "Brand", name: "Doceterapia" },
    offers: {
      "@type": "Offer",
      url: `${SITE}/doce/${slug}`,
      priceCurrency: "BRL",
      price: aPagar.toFixed(2),
      availability: temEstoque
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: "Doceterapia" },
    },
    ...((produto.totalAvaliacoes ?? 0) > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: (produto.notaMedia ?? 0).toFixed(1),
            reviewCount: produto.totalAvaliacoes,
          },
        }
      : {}),
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
      {/* Pro Google: nome, preço que ela paga e disponibilidade, em formato
          de máquina. É o que rende preço e estrelas no resultado da busca. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(dadosEstruturados(doce.produto, params.slug)),
        }}
      />
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
