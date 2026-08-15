import type { MetadataRoute } from "next";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { produtos } from "@/lib/db/schema";
import { slugDoProduto } from "@/lib/slug";
import { SITE } from "@/lib/site";

/**
 * O mapa do site para o Google — com um endereço por doce.
 *
 * Cada doce tem página própria (é o link que a Camily manda no story), e sem
 * este mapa o buscador só chegava neles se alguém tivesse linkado de fora.
 *
 * `force-dynamic` porque o cardápio muda: doce novo precisa entrar no mapa no
 * dia em que ela cadastra, não no próximo deploy.
 */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fixas: MetadataRoute.Sitemap = [
    { url: `${SITE}/catalogo`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE}/promocoes`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE}/loja`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE}/politica`, changeFrequency: "yearly", priority: 0.3 },
  ];

  try {
    const doces = await getDb()
      .select({ id: produtos.id, nome: produtos.nome, criadoEm: produtos.criadoEm })
      .from(produtos)
      .where(eq(produtos.ativo, true))
      .orderBy(asc(produtos.nome));

    return [
      ...fixas,
      ...doces.map((d) => ({
        url: `${SITE}/doce/${slugDoProduto({ id: d.id, nome: d.nome })}`,
        lastModified: d.criadoEm ?? undefined,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ];
  } catch {
    // Banco fora do ar não pode derrubar o mapa inteiro: as páginas fixas
    // continuam valendo.
    return fixas;
  }
}
