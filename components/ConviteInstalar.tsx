"use client";

import { useEffect, useState } from "react";

/**
 * O convite pra deixar a Doceterapia na tela de início do celular.
 *
 * Quem chega pela bio do Instagram refaz o mesmo caminho toda vez: abrir o
 * Instagram, achar o perfil, tocar no link. Com o site na tela de início, a
 * próxima compra começa a um toque.
 *
 * São dois mundos diferentes:
 *
 * - **Android/Chrome** dispara `beforeinstallprompt` e deixa o site abrir a
 *   janela de instalação. Aí é um botão só.
 * - **iPhone** não tem nada disso. O único caminho é Compartilhar → Adicionar
 *   à Tela de Início, feito pela pessoa. Então ali o convite VIRA instrução —
 *   um botão que não instala nada seria pior do que não ter botão.
 *
 * Quem fecha não vê de novo por um bom tempo: insistir em quem já disse não é
 * o jeito mais rápido de virar propaganda chata.
 */

const DIAS_DE_SOSSEGO = 30;

/**
 * Os textos mudam conforme quem está lendo: a cliente no cardápio e a Camily
 * no painel querem coisas diferentes na tela de início. A lógica de quando
 * convidar — e de quando calar a boca — é a mesma para as duas, e por isso
 * mora num componente só.
 *
 * `chave` precisa ser diferente em cada lugar: dispensar o convite da loja
 * não pode esconder o do painel.
 */
type Props = {
  titulo?: string;
  /** Aparece no Android, junto do botão que instala de verdade. */
  descricao?: string;
  /** Aparece no iPhone, onde só a pessoa consegue adicionar. */
  instrucaoIPhone?: React.ReactNode;
  rotuloDoBotao?: string;
  chave?: string;
};

/** O evento do Chrome, que o TypeScript ainda não conhece. */
type EventoDeInstalar = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function foiDispensadoHaPouco(chave: string): boolean {
  try {
    const quando = Number(localStorage.getItem(chave));
    if (!quando) return false;
    return Date.now() - quando < DIAS_DE_SOSSEGO * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/** Já está instalado? Aí não há nada a convidar. */
function jaEstaInstalado(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // O Safari do iPhone não implementa `display-mode`; ele marca isto.
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function ehIPhoneOuIPad(): boolean {
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    // iPad moderno se apresenta como Mac; o toque é o que o entrega.
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  );
}

export default function ConviteInstalar({
  titulo = "Deixe a Doceterapia na sua tela de início",
  descricao = "Fica com ícone igual ao de um aplicativo — e a próxima encomenda começa a um toque.",
  instrucaoIPhone = (
    <>
      Toque em <strong>Compartilhar</strong> aqui embaixo no navegador e depois em{" "}
      <strong>Adicionar à Tela de Início</strong>. Aí a gente fica pertinho. 🍒
    </>
  ),
  rotuloDoBotao = "Adicionar à tela de início",
  chave = "dt_convite_instalar",
}: Props) {
  const [evento, setEvento] = useState<EventoDeInstalar | null>(null);
  const [mostrarNoIPhone, setMostrarNoIPhone] = useState(false);
  const [fechado, setFechado] = useState(false);

  useEffect(() => {
    if (jaEstaInstalado() || foiDispensadoHaPouco(chave)) return;

    function aoPoderInstalar(e: Event) {
      // Sem isto o Chrome mostra a barra dele, no rodapé, bem em cima da
      // nossa barra de navegação.
      e.preventDefault();
      setEvento(e as EventoDeInstalar);
    }

    window.addEventListener("beforeinstallprompt", aoPoderInstalar);
    // No iPhone o convite é instrução, e só faz sentido no Safari — dentro do
    // navegador do Instagram não existe "Adicionar à Tela de Início".
    if (ehIPhoneOuIPad() && /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent)) {
      setMostrarNoIPhone(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", aoPoderInstalar);
  }, [chave]);

  function fechar() {
    setFechado(true);
    try {
      localStorage.setItem(chave, String(Date.now()));
    } catch {
      // Navegador com armazenamento bloqueado: o convite some só nesta visita.
    }
  }

  async function instalar() {
    if (!evento) return;
    await evento.prompt();
    await evento.userChoice;
    // O evento vale uma vez só; depois dele o navegador não devolve outro.
    setEvento(null);
    fechar();
  }

  if (fechado || (!evento && !mostrarNoIPhone)) return null;

  return (
    <div className="max-w-5xl mx-auto mb-6 bg-white/70 border border-cherryLight/40 rounded-2xl px-4 py-3.5 flex items-start gap-3">
      <span className="text-2xl leading-none shrink-0" aria-hidden>
        🍒
      </span>

      <div className="min-w-0 flex-1">
        <p className="font-display text-base text-cherryDark leading-tight">{titulo}</p>

        {evento ? (
          <>
            <p className="font-body text-sm text-ink/65 mt-1">{descricao}</p>
            <button
              onClick={instalar}
              className="mt-2.5 bg-cherryDark text-white rounded-full px-5 py-2.5 font-body font-semibold text-sm hover:bg-cherryMid transition-colors"
            >
              {rotuloDoBotao}
            </button>
          </>
        ) : (
          <p className="font-body text-sm text-ink/65 mt-1">{instrucaoIPhone}</p>
        )}
      </div>

      <button
        onClick={fechar}
        aria-label="Agora não"
        className="shrink-0 w-11 h-11 -mr-2 -mt-2 rounded-full text-ink/40 text-lg hover:text-cherryDark"
      >
        ×
      </button>
    </div>
  );
}
