"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { EVENTO_CARRINHO, totalDeItens } from "@/lib/store";

/**
 * A barra de navegação fixa no rodapé.
 *
 * Quase todo mundo chega pelo link da bio do Instagram, no celular, e segura
 * o telefone com uma mão só — no alto da tela o polegar não alcança. Aqui os
 * quatro caminhos do site ficam onde o dedo já está, do mesmo jeito que os
 * apps de delivery que a cliente usa todo dia.
 *
 * Só aparece nas telas do cliente: no painel da Camily ela atrapalharia, e no
 * checkout ela brigaria com o botão de pagar.
 */

const ITENS = [
  { href: "/catalogo", emoji: "🍰", label: "Cardápio" },
  { href: "/promocoes", emoji: "🎁", label: "Promoções" },
  { href: "/carrinho", emoji: "🛒", label: "Carrinho" },
  { href: "/conta", emoji: "👤", label: "Conta" },
];

/** Telas onde a barra atrapalha mais do que ajuda. */
const ESCONDER_EM = ["/admin", "/checkout", "/entrar", "/cadastro", "/esqueci-senha", "/redefinir-senha"];

export default function BarraInferior() {
  const caminho = usePathname() ?? "";
  const [itens, setItens] = useState(0);

  // Mesmo contador do cabeçalho: reage a quem adiciona por aqui (evento
  // próprio) e a quem mexe no carrinho em outra aba (evento storage).
  useEffect(() => {
    const atualizar = () => setItens(totalDeItens());
    atualizar();
    window.addEventListener(EVENTO_CARRINHO, atualizar);
    window.addEventListener("storage", atualizar);
    return () => {
      window.removeEventListener(EVENTO_CARRINHO, atualizar);
      window.removeEventListener("storage", atualizar);
    };
  }, []);

  if (ESCONDER_EM.some((rota) => caminho.startsWith(rota))) return null;

  return (
    /*
     * A altura vira variável CSS porque o `layout.tsx` usa ela pra dar folga
     * no fim das páginas — senão a barra cobriria o último botão de cada
     * tela. O `safe-area-inset-bottom` é a faixa do iPhone sem botão físico:
     * sem ela, os rótulos ficam por baixo da barrinha do sistema.
     */
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur shadow-[0_-15px_45px_rgba(10,10,10,0.10)] pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex items-stretch justify-center max-w-lg mx-auto">
        {ITENS.map((item) => {
          // "/conta/pedidos" também acende "Conta"; "/" não acende nada além
          // do cardápio, que é a tela inicial.
          const ativo =
            caminho === item.href || caminho.startsWith(`${item.href}/`);

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={ativo ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] font-body transition-colors ${
                  ativo ? "text-cherryDark" : "text-ink/45 hover:text-cherryMid"
                }`}
              >
                <span className="relative text-xl leading-none" aria-hidden="true">
                  {item.emoji}
                  {/* O número do carrinho fica na quina do emoji: é o único
                      lugar da barra onde sobra espaço sem empurrar o rótulo. */}
                  {item.href === "/carrinho" && itens > 0 && (
                    <span className="absolute -top-1 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-cherryDark text-white text-[10px] font-semibold flex items-center justify-center tabular-nums">
                      {itens}
                    </span>
                  )}
                </span>
                <span
                  className={`text-[10px] leading-none ${ativo ? "font-semibold" : ""}`}
                >
                  {item.label}
                </span>
                {item.href === "/carrinho" && itens > 0 && (
                  <span className="sr-only">
                    {itens} {itens === 1 ? "item" : "itens"} no carrinho
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
