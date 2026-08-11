"use client";

import Link from "next/link";
import CherryDivider from "./CherryDivider";
import IconeWhatsApp from "./IconeWhatsApp";
import { useSobre } from "@/lib/usar-sobre";

/**
 * O "quem faz" do site: a foto da Camily, o recado dela e o telefone.
 *
 * Tudo vem do painel (`/admin/sobre`), então ela troca a foto, reescreve o
 * texto e muda de número sem precisar de programador. O telefone é um link
 * que abre o WhatsApp — é o caminho que a cliente mais procura, e escrever o
 * número pra ela copiar à mão era pedir demais no celular.
 */
export default function Footer() {
  const { foto, texto, telefone, linkWhatsApp } = useSobre();

  return (
    <footer className="mt-20 px-6 md:px-12 py-12 bg-blush/60">
      <CherryDivider />
      <div className="max-w-2xl mx-auto text-center">
        <div className="w-28 h-28 rounded-full mx-auto bg-cherryLight/40 overflow-hidden flex items-center justify-center text-4xl">
          {foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={foto}
              alt="Camily Vilasboa"
              className="w-full h-full object-cover"
            />
          ) : (
            "🍒"
          )}
        </div>
        <h3 className="font-display text-xl mt-4 text-cherryDark">Camily Vilasboa</h3>
        <p className="font-body text-sm text-ink/70 mt-2 max-w-md mx-auto whitespace-pre-line">
          {texto}
        </p>

        <a
          href={linkWhatsApp("Oi, Camily! Vi o site da Doceterapia e queria falar com você.")}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 mt-4 font-body text-sm text-cherryDark bg-white/70 border border-cherryLight/50 rounded-full px-5 py-3 hover:bg-white transition-colors"
        >
          {/* O símbolo do WhatsApp no verde da marca: é ele que faz a cliente
              reconhecer, de relance, que tocar ali abre a conversa. */}
          <IconeWhatsApp className="w-5 h-5 text-[#25D366]" />
          {telefone}
        </a>

        {/* As regras da loja ficam a um toque de qualquer tela do cliente —
            é onde ele procura quando bate a dúvida de "e se eu desistir?". */}
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-5 font-body text-xs text-ink/60">
          <Link href="/loja" className="underline inline-flex items-center min-h-[44px] px-1 hover:text-cherryDark">
            Sobre a loja
          </Link>
          <Link href="/politica" className="underline inline-flex items-center min-h-[44px] px-1 hover:text-cherryDark">
            Cancelamento e reembolso
          </Link>
          <Link href="/conta" className="underline inline-flex items-center min-h-[44px] px-1 hover:text-cherryDark">
            Minha conta
          </Link>
          <Link href="/catalogo" className="underline inline-flex items-center min-h-[44px] px-1 hover:text-cherryDark">
            Cardápio
          </Link>
        </nav>
      </div>
    </footer>
  );
}
