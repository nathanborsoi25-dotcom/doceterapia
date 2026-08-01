"use client";

/**
 * Estrelinhas da avaliação.
 *
 * Serve pra duas coisas: mostrar a nota que um doce já tem (modo leitura) e
 * deixar o cliente escolher a dele (quando recebe `onChange`). No modo de
 * escolher, cada estrela é um botão de verdade — assim funciona no toque do
 * celular e também pra quem navega pelo teclado.
 */
export default function Estrelas({
  nota,
  onChange,
  tamanho = "md",
}: {
  nota: number;
  onChange?: (nota: number) => void;
  tamanho?: "sm" | "md" | "lg";
}) {
  const classe = { sm: "text-sm", md: "text-lg", lg: "text-3xl" }[tamanho];
  const estrelas = [1, 2, 3, 4, 5];

  if (!onChange) {
    return (
      <span className={`${classe} leading-none tracking-tight`} aria-label={`Nota ${nota} de 5`}>
        {estrelas.map((e) => (
          <span key={e} className={e <= Math.round(nota) ? "text-amber-500" : "text-ink/20"}>
            ★
          </span>
        ))}
      </span>
    );
  }

  return (
    <span className="flex gap-1">
      {estrelas.map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => onChange(e)}
          aria-label={`${e} ${e === 1 ? "estrela" : "estrelas"}`}
          className={`${classe} leading-none transition-transform active:scale-90 ${
            e <= nota ? "text-amber-500" : "text-ink/25"
          }`}
        >
          ★
        </button>
      ))}
    </span>
  );
}
