"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getClienteLogado } from "@/lib/api";
import { EVENTO_CARRINHO, totalDeItens } from "@/lib/store";
import {
  contarNovidadesEscrito,
  EVENTO_NOVIDADES,
  SEM_NOVIDADES,
  type Novidades,
} from "@/lib/novidades";
import { temPromocaoNova } from "@/lib/promocoes-vistas";

/**
 * A barra de navegação fixa no rodapé.
 *
 * Quase todo mundo chega pelo link da bio do Instagram, no celular, e segura
 * o telefone com uma mão só — no alto da tela o polegar não alcança. Aqui os
 * quatro caminhos do site ficam onde o dedo já está, do mesmo jeito que os
 * apps de delivery que a cliente usa todo dia.
 *
 * Só aparece nas telas do cliente: no painel da Camily ela atrapalharia, e nas
 * telas de entrar/cadastrar ela convida a sair no meio do caminho.
 *
 * No checkout ela FICA. A ideia de tirá-la de lá era não brigar com o botão de
 * pagar, mas quem está pagando é justamente quem mais precisa voltar ao
 * carrinho pra conferir o pedido — e sem a barra o caminho de volta some.
 */

const ITENS = [
  { href: "/catalogo", emoji: "🍰", label: "Cardápio" },
  { href: "/promocoes", emoji: "🎁", label: "Promoções" },
  { href: "/carrinho", emoji: "🛒", label: "Carrinho" },
  { href: "/conta", emoji: "👤", label: "Conta" },
] as const;

/** Telas onde a barra atrapalha mais do que ajuda. */
const ESCONDER_EM = ["/admin", "/entrar", "/cadastro", "/esqueci-senha", "/redefinir-senha"];

export default function BarraInferior() {
  const caminho = usePathname() ?? "";
  const [itens, setItens] = useState(0);
  /** `null` enquanto a resposta não chega — aí o último item não pisca. */
  const [logado, setLogado] = useState<boolean | null>(null);
  /** Pedido esperando pagamento ou com situação nova, ainda não vista. */
  const [novidades, setNovidades] = useState<Novidades>(SEM_NOVIDADES);
  /** Tem banner, cupom ou prêmio novo que esta pessoa ainda não viu. */
  const [promocaoNova, setPromocaoNova] = useState(false);

  useEffect(() => {
    getClienteLogado()
      .then((c) => setLogado(Boolean(c)))
      .catch(() => setLogado(false));
  }, []);

  /*
   * Os avisos são conferidos a cada troca de tela, e não só na primeira: a
   * situação do pedido muda pelo lado da Camily, enquanto a cliente navega.
   * Trocar de tela é o momento barato de perguntar — sem relógio batendo no
   * servidor de quem só está olhando o cardápio.
   */
  useEffect(() => {
    function buscar() {
      fetch("/api/cliente/novidades", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : SEM_NOVIDADES))
        .then((n: Novidades) => {
          setNovidades(n);
          // Quem compara é o navegador: a tela de promoções serve visitante
          // sem conta, e a última visita dela mora aqui, não no banco.
          setPromocaoNova(temPromocaoNova(n.promocoesEm));
        })
        .catch(() => setNovidades(SEM_NOVIDADES));
    }
    buscar();
    window.addEventListener(EVENTO_NOVIDADES, buscar);
    return () => window.removeEventListener(EVENTO_NOVIDADES, buscar);
  }, [caminho]);

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

  /*
   * Quem ainda não entrou vê "Entrar" no lugar de "Conta". Levar essa pessoa
   * para /conta seria empurrá-la a uma tela vazia e depois para o login do
   * mesmo jeito — um toque a mais para chegar no mesmo lugar.
   */
  const lista = ITENS.map((item) =>
    item.href === "/conta" && logado === false
      ? { href: "/entrar", emoji: "🔑", label: "Entrar" }
      : item
  );

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
        {lista.map((item) => {
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
                  {/*
                   * O aviso da conta, na mesma quina e do mesmo tamanho do
                   * contador do carrinho — duas marcas diferentes na mesma
                   * barra fariam a pessoa achar que significam coisas
                   * distintas.
                   *
                   * É um `<span>`, e não um botão: o CSS global estica
                   * qualquer `<button>` para 44px no toque, e foi assim que
                   * as bolinhas do carrossel viraram duas barras brancas no
                   * meio da foto, em 10/08.
                   */}
                  {item.href === "/conta" && novidades.total > 0 && (
                    <span className="absolute -top-1 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-cherryDark text-white text-[10px] font-semibold flex items-center justify-center tabular-nums">
                      {novidades.total}
                    </span>
                  )}
                  {/*
                   * Promoção nova: bolinha SEM número.
                   *
                   * Não há o que contar aqui — a cliente não quer saber
                   * "3 novidades", quer saber que vale a pena olhar. Um
                   * número inventado (banners + cupons + prêmios) só criaria
                   * a pergunta "três o quê?".
                   */}
                  {item.href === "/promocoes" && promocaoNova && (
                    <span className="absolute top-0 -right-1.5 w-2.5 h-2.5 rounded-full bg-cherryDark ring-2 ring-white" />
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
                {/* Pro leitor de tela o número sozinho não diz nada: aqui vai
                    a frase inteira, dizendo de que aviso se trata. */}
                {item.href === "/conta" && novidades.total > 0 && (
                  <span className="sr-only">
                    {contarNovidadesEscrito(novidades)}
                  </span>
                )}
                {item.href === "/promocoes" && promocaoNova && (
                  <span className="sr-only">tem novidade nas promoções</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
