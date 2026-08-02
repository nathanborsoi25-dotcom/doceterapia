import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { pedidos, stories } from "@/lib/db/schema";
import { getClienteLogado } from "@/lib/cliente-logado";

export const dynamic = "force-dynamic";

/** Formatos de print que o navegador e o celular geram. */
const TIPOS_ACEITOS = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic", // print de iPhone
  "image/heif",
];

const TAMANHO_MAXIMO = 8 * 1024 * 1024;

/** Os stories que a cliente já mandou, pra tela mostrar a situação de cada um. */
export async function GET() {
  const cliente = await getClienteLogado();
  if (!cliente) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const linhas = await getDb()
    .select()
    .from(stories)
    .where(eq(stories.clienteId, cliente.id))
    .orderBy(desc(stories.criadoEm));

  return NextResponse.json(
    linhas.map((s) => ({
      id: s.id,
      pedidoId: s.pedidoId,
      situacao: s.situacao,
      pontosCreditados: s.pontosCreditados,
      motivoRecusa: s.motivoRecusa,
      criadoEm: s.criadoEm.toISOString(),
    }))
  );
}

/**
 * A cliente enviando o print do story que postou marcando a loja.
 *
 * Não credita ponto nenhum aqui: fica pendente até a Camily aprovar no
 * painel. É o que impede alguém de mandar qualquer foto e sair ganhando —
 * e, de quebra, faz ela ver o story pra repostar.
 */
export async function POST(req: Request) {
  const cliente = await getClienteLogado();
  if (!cliente) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const arquivo = form?.get("imagem");
  const pedidoId = String(form?.get("pedidoId") ?? "");
  const arroba = String(form?.get("arroba") ?? "")
    .trim()
    .replace(/^@+/, "")
    .slice(0, 40);

  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return NextResponse.json({ error: "Escolha o print do story." }, { status: 400 });
  }
  if (!TIPOS_ACEITOS.includes(arquivo.type)) {
    return NextResponse.json(
      { error: "Esse arquivo não é uma imagem. Use JPG, PNG ou WEBP." },
      { status: 400 }
    );
  }
  if (arquivo.size > TAMANHO_MAXIMO) {
    return NextResponse.json(
      { error: "A imagem é muito grande. O limite é 8 MB." },
      { status: 400 }
    );
  }

  // O pedido tem que ser dela e já ter sido entregue — o ponto do story é
  // pra quem comprou e recebeu, não pra quem só criou uma conta.
  const db = getDb();
  const [pedido] = await db.select().from(pedidos).where(eq(pedidos.id, pedidoId));
  if (!pedido || pedido.clienteId !== cliente.id) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }
  if (pedido.status !== "concluido") {
    return NextResponse.json(
      { error: "Você pode enviar o story depois que o pedido for entregue." },
      { status: 400 }
    );
  }

  const extensao = (arquivo.name.split(".").pop() ?? "jpg")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 5);

  const { url } = await put(`stories/print.${extensao}`, arquivo, {
    access: "public",
    addRandomSuffix: true,
    contentType: arquivo.type,
  });

  // O índice único (pedido) é quem garante um story por compra, mesmo se o
  // botão for tocado duas vezes seguidas.
  const criados = await db
    .insert(stories)
    .values({
      id: crypto.randomUUID(),
      clienteId: cliente.id,
      pedidoId,
      imagemUrl: url,
      arroba,
    })
    .onConflictDoNothing()
    .returning({ id: stories.id });

  if (criados.length === 0) {
    return NextResponse.json(
      { error: "Você já enviou um story para este pedido." },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true });
}
