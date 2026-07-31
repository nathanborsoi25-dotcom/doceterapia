import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

/** Formatos que o navegador do cliente sabe mostrar. */
const TIPOS_ACEITOS = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic", // fotos de iPhone
  "image/heif",
];

/** 8 MB: foto de celular passa fácil disso, então a tela avisa antes. */
const TAMANHO_MAXIMO = 8 * 1024 * 1024;

/**
 * Recebe a foto que a Camily escolheu no celular ou no computador, guarda no
 * armazenamento de arquivos e devolve o endereço público da imagem, que é o
 * que fica salvo no produto.
 */
export async function POST(req: Request) {
  const negado = await requireAdmin();
  if (negado) return negado;

  const form = await req.formData().catch(() => null);
  const arquivo = form?.get("foto");

  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return NextResponse.json({ error: "Escolha uma foto." }, { status: 400 });
  }

  if (!TIPOS_ACEITOS.includes(arquivo.type)) {
    return NextResponse.json(
      { error: "Esse arquivo não é uma foto. Use JPG, PNG ou WEBP." },
      { status: 400 }
    );
  }

  if (arquivo.size > TAMANHO_MAXIMO) {
    return NextResponse.json(
      { error: "A foto é muito grande. O limite é 8 MB." },
      { status: 400 }
    );
  }

  // Mantém a extensão original e deixa o Blob sortear um sufixo, pra duas
  // fotos com o mesmo nome não se sobrescreverem.
  const extensao = (arquivo.name.split(".").pop() ?? "jpg")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 5);

  const { url } = await put(`produtos/foto.${extensao}`, arquivo, {
    access: "public",
    addRandomSuffix: true,
    contentType: arquivo.type,
  });

  return NextResponse.json({ url });
}
