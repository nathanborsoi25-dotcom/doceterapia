import { fotoOtimizada, TAMANHO } from "@/lib/foto-otimizada";
import { temaNatalino } from "@/lib/tema-da-loja";

export default function RetratoCamily({ foto }: { foto: string }) {
  return (
    <div className={temaNatalino ? "retrato-camily-natal" : undefined}>
      <div className="relative mx-auto w-28">
        <div className="retrato-camily-foto flex h-28 items-center justify-center overflow-hidden rounded-full bg-cherryLight/40 text-4xl">
          {foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fotoOtimizada(foto, TAMANHO.rodape)}
              alt="Camily Vilasboa"
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            "🍒"
          )}
        </div>
        {temaNatalino && foto && (
          <span className="natal-gorro natal-gorro-retrato" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
