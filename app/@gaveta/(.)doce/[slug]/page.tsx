import { notFound } from "next/navigation";
import Gaveta from "@/components/doce/Gaveta";
import DetalheDoce from "@/components/doce/DetalheDoce";
import { buscarDocePorSlug } from "@/lib/doce";

export const dynamic = "force-dynamic";

/**
 * O mesmo doce, mas aberto por dentro do cardápio.
 *
 * O Next intercepta a navegação: quem já está no site vê a gaveta subir; quem
 * chega pelo link do story cai na página inteira (`app/doce/[slug]`). O
 * conteúdo é o mesmo componente nos dois casos, então nunca ficam diferentes.
 */
export default async function DoceNaGaveta({
  params,
}: {
  params: { slug: string };
}) {
  const doce = await buscarDocePorSlug(params.slug);
  if (!doce) notFound();

  return (
    <Gaveta>
      <DetalheDoce produto={doce.produto} avaliacoes={doce.avaliacoes} />
    </Gaveta>
  );
}
