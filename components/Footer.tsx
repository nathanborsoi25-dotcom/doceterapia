import Link from "next/link";
import CherryDivider from "./CherryDivider";
import { TELEFONE_EXIBICAO } from "@/lib/contato";

export default function Footer() {
  return (
    <footer className="mt-20 px-6 md:px-12 py-12 bg-blush/60">
      <CherryDivider />
      <div className="max-w-2xl mx-auto text-center">
        {/*
          TODO(Camily): troque o div abaixo por sua foto real, ex:
          <img src="/sua-foto.jpg" alt="Camily Vilasboa" className="w-28 h-28 rounded-full mx-auto object-cover" />
        */}
        <div className="w-28 h-28 rounded-full mx-auto bg-cherryLight/40 flex items-center justify-center text-4xl">
          🍒
        </div>
        <h3 className="font-display text-xl mt-4 text-cherryDark">Camily Vilasboa</h3>
        <p className="font-body text-sm text-ink/70 mt-2 max-w-md mx-auto">
          Feito à mão, com carinho, para adoçar o seu dia. Cada doce da
          Doceterapia carrega um pouquinho de mim — obrigada por fazer parte
          dessa história.
        </p>
        <p className="font-body text-sm text-cherryMid mt-3">{TELEFONE_EXIBICAO}</p>

        {/* As regras da loja ficam a um toque de qualquer tela do cliente —
            é onde ele procura quando bate a dúvida de "e se eu desistir?". */}
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-5 font-body text-xs text-ink/60">
          <Link href="/politica" className="underline py-2 hover:text-cherryDark">
            Cancelamento e reembolso
          </Link>
          <Link href="/conta" className="underline py-2 hover:text-cherryDark">
            Minha conta
          </Link>
          <Link href="/catalogo" className="underline py-2 hover:text-cherryDark">
            Cardápio
          </Link>
        </nav>
      </div>
    </footer>
  );
}
