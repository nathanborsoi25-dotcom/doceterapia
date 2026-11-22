import { fotoOtimizada, TAMANHO } from "@/lib/foto-otimizada";
import { temaNatalino } from "@/lib/tema-da-loja";

// A edição natalina pertence a esta foto. Uma foto nova enviada pelo painel
// deve aparecer normalmente, mesmo durante a campanha.
const FOTO_ORIGINAL = "https://y9um9kadn6mqu4qr.public.blob.vercel-storage.com/produtos/foto-0b1HhZLzeHRiVIJ6tT3LY571aF4xov.png";

export default function RetratoCamily({ foto }: { foto: string }) {
  const src = temaNatalino && foto === FOTO_ORIGINAL
    ? "/camily-natal-retrato.jpg"
    : fotoOtimizada(foto, TAMANHO.rodape);

  return (
    <div className={`flex h-28 w-28 mx-auto items-center justify-center overflow-hidden rounded-full bg-cherryLight/40 text-4xl${temaNatalino ? " retrato-camily-natal" : ""}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt="Camily Vilasboa"
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        "🍒"
      )}
    </div>
  );
}
