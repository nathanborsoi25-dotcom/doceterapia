"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import CherryDivider from "@/components/CherryDivider";
import RodapeLinks from "@/components/RodapeLinks";
import { bannersVisiveis, type BannerDaLoja } from "@/lib/banners";
import { reais } from "@/lib/formato";
import { getMinhaConta, type MinhaConta } from "@/lib/api";

/**
 * Tudo o que está em promoção, num lugar só.
 *
 * Antes isso estava espalhado: o banner aparecia no topo do cardápio e os
 * cupons ficavam escondidos dentro de "Minha conta", numa aba que só quem já
 * tinha conta encontrava. Quem chega pelo Instagram procurando desconto não
 * ia achar nem um nem outro.
 */
/** Quanto cada coisa rende de ponto. Quem define é a Camily, no painel. */
type RegrasDePonto = {
  pontosPorReal: number;
  pontosPorAvaliacao: number;
  pontosPorStory: number;
};

type Recompensa = { id: string; nome: string; descricao: string; pontos: number };

/**
 * Quanto rende comprar, escrito do jeito que se fala.
 *
 * A Camily configura "pontos por real", e hoje isso vale **0,1** — dizer
 * "0.1 pontos a cada R$ 1,00" não significa nada pra quem lê (e ainda sai com
 * ponto no lugar de vírgula). Abaixo de 1, a frase vira de cabeça pra baixo:
 * "1 ponto a cada R$ 10,00", que é a mesma conta em português.
 */
function quantoRendeComprar(pontosPorReal: number): string {
  if (pontosPorReal <= 0) return "Você ganha pontos a cada compra.";

  const inicio =
    pontosPorReal >= 1
      ? `${pontosPorReal === 1 ? "1 ponto" : `${pontosPorReal} pontos`} a cada ${reais(1)}`
      : `1 ponto a cada ${reais(1 / pontosPorReal)}`;

  return `${inicio} gasto. Os pontos entram quando o pagamento é confirmado.`;
}

export default function PromocoesPage() {
  const [banners, setBanners] = useState<BannerDaLoja[]>([]);
  const [regras, setRegras] = useState<RegrasDePonto | null>(null);
  const [premios, setPremios] = useState<Recompensa[]>([]);
  const [conta, setConta] = useState<MinhaConta | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    fetch("/api/config-loja", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => {
        setBanners(bannersVisiveis(c));
        if (c) {
          setRegras({
            pontosPorReal: Number(c.pontosPorReal) || 0,
            pontosPorAvaliacao: Number(c.pontosPorAvaliacao) || 0,
            pontosPorStory: Number(c.pontosPorStory) || 0,
          });
        }
      })
      .catch(() => setBanners([]))
      .finally(() => setCarregando(false));

    /*
     * O catálogo de prêmios é público de propósito: quem ainda não tem conta
     * precisa ver pelo que os pontos são trocados ANTES de decidir criar uma.
     */
    fetch("/api/recompensas", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setPremios)
      .catch(() => setPremios([]));

    // Sem conta isso falha, e tudo bem: os cupons pessoais e o saldo só
    // existem pra quem entrou. O resto da tela continua valendo pra visitante.
    getMinhaConta()
      .then(setConta)
      .catch(() => setConta(null));
  }, []);

  const cupons = conta?.cupons ?? [];
  const vazia = !carregando && banners.length === 0 && cupons.length === 0;

  /** As três formas de ganhar ponto, com os números que valem hoje. */
  const formasDeGanhar = [
    {
      emoji: "🛍️",
      titulo: "Comprando",
      texto: quantoRendeComprar(regras?.pontosPorReal ?? 0),
    },
    {
      emoji: "⭐",
      titulo: "Avaliando o doce",
      texto:
        regras && regras.pontosPorAvaliacao > 0
          ? `${regras.pontosPorAvaliacao} pontos por doce avaliado, depois que o pedido chega. Sua nota ainda ajuda outras pessoas a escolherem.`
          : "Avalie os doces que você recebeu e ganhe pontos.",
    },
    {
      emoji: "📸",
      titulo: "Postando nos stories",
      texto:
        regras && regras.pontosPorStory > 0
          ? `${regras.pontosPorStory} pontos: poste marcando @doceterapia_28, mande o print em Meus pedidos e a Camily libera os pontos.`
          : "Poste o doce marcando @doceterapia_28 e mande o print.",
    },
  ];

  return (
    <>
      <Header />
      <main className="px-4 sm:px-6 md:px-12 pb-16 max-w-3xl mx-auto">
        <h1 className="font-display text-2xl sm:text-3xl text-center text-cherryDark">
          Promoções
        </h1>
        <CherryDivider />

        {carregando && (
          <p className="font-body text-ink/60 text-center py-8">
            Procurando as novidades...
          </p>
        )}

        {vazia && (
          <div className="text-center py-10 grid gap-3">
            <span className="text-5xl">🍒</span>
            <p className="font-body text-ink/70">
              Nenhuma promoção rolando agora. Volte logo — a Camily solta
              novidade de vez em quando.
            </p>
            <Link
              href="/catalogo"
              className="justify-self-center bg-cherryDark text-white rounded-full px-6 py-3 font-body font-semibold hover:bg-cherryMid transition-colors"
            >
              Ver o cardápio
            </Link>
          </div>
        )}

        {/*
         * O desconto do Pix NÃO é anunciado aqui: a Camily prefere contar isso
         * na arte de um banner, e o site escrever a mesma coisa logo acima
         * seria dizer duas vezes. Ele continua aparecendo onde decide a
         * compra — no botão de pagar — e no perfil da loja.
         */}

        {/* Os destaques que a Camily cadastrou, agora em grade — aqui a
            pessoa veio justamente pra olhar todos, não pra passar de lado. */}
        {banners.length > 0 && (
          <section className="mb-8">
            <h2 className="font-display text-xl text-cherryDark mb-3">
              Em destaque
            </h2>
            {/* Só as artes, como no topo do cardápio: o texto da promoção já
                está escrito dentro da imagem. */}
            <div className="grid gap-3 sm:grid-cols-2">
              {banners.map((b) => (
                <Link
                  key={b.id}
                  href={b.link || "/catalogo"}
                  aria-label={b.titulo || "Ver a promoção"}
                  className="block rounded-2xl overflow-hidden bg-blush/60 border border-cherryLight/40 hover:border-cherryDark transition-colors"
                >
                  {b.imagem ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={b.imagem}
                      alt={b.titulo || "Promoção"}
                      className="w-full aspect-[2/1] object-cover"
                    />
                  ) : (
                    <span className="flex items-center justify-center w-full aspect-[2/1] px-6 text-center font-display text-lg text-cherryDark">
                      {b.titulo}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Cupons: os mesmos de "Minha conta", trazidos pra cá. Sem conta, o
            convite pra entrar toma o lugar da lista. */}
        <section>
          <h2 className="font-display text-xl text-cherryDark mb-3">
            Seus cupons
          </h2>

          {conta === null && !carregando ? (
            <div className="bg-white/60 border border-cherryLight/30 rounded-2xl p-5 text-center grid gap-3">
              <p className="font-body text-sm text-ink/70">
                Entre na sua conta para ver os cupons que a Camily separou pra
                você.
              </p>
              <Link
                href="/entrar?voltar=/promocoes"
                className="justify-self-center bg-cherryDark text-white rounded-full px-6 py-3 font-body font-semibold hover:bg-cherryMid transition-colors"
              >
                Entrar
              </Link>
            </div>
          ) : cupons.length === 0 ? (
            <p className="font-body text-sm text-ink/60">
              Nenhum cupom no momento. 🍒
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {cupons.map((c) => (
                <CartaoCupom key={c.codigo} cupom={c} />
              ))}
            </div>
          )}
        </section>

        <CherryDivider />

        {/* ---------- Programa de pontos ---------- */}
        <section>
          <h2 className="font-display text-xl text-cherryDark">
            Junte pontos e troque por doce
          </h2>
          <p className="font-body text-sm text-ink/60 mt-1">
            Cada compra, cada avaliação e cada story viram pontos na sua conta.
            Quando junta o suficiente, você troca por um dos prêmios aqui de
            baixo.
          </p>

          {/* Quem está logado vê o próprio saldo — é o que dá sentido aos
              números dos prêmios logo abaixo. */}
          {conta && (
            <div className="bg-cherryDark text-white rounded-2xl p-5 text-center mt-3">
              <p className="font-body text-white/70 text-xs uppercase tracking-wide">
                Seus pontos
              </p>
              <p className="font-display text-4xl mt-1">{conta.saldoPontos}</p>
            </div>
          )}

          <div className="grid gap-2 mt-3">
            {formasDeGanhar.map((f) => (
              <div
                key={f.titulo}
                className="flex items-start gap-3 bg-white/70 border border-cherryLight/30 rounded-xl px-4 py-3 font-body text-sm"
              >
                <span className="text-xl leading-none shrink-0" aria-hidden="true">
                  {f.emoji}
                </span>
                <span className="min-w-0">
                  <span className="block text-ink/85 font-semibold">{f.titulo}</span>
                  <span className="block text-xs text-ink/60 mt-0.5">{f.texto}</span>
                </span>
              </div>
            ))}
          </div>

          {premios.length > 0 && (
            <>
              <h3 className="font-display text-lg text-cherryDark mt-6">
                O que dá pra trocar
              </h3>
              <div className="grid gap-2 mt-2">
                {premios.map((p) => {
                  // Só quem está logado tem saldo pra comparar.
                  const falta = conta ? p.pontos - conta.saldoPontos : null;
                  const podeResgatar = falta !== null && falta <= 0;
                  return (
                    <div
                      key={p.id}
                      className={`flex flex-wrap items-center justify-between gap-2 border rounded-xl px-4 py-3 font-body text-sm ${
                        podeResgatar
                          ? "bg-green-50 border-green-200"
                          : "bg-white/70 border-cherryLight/30"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-ink/85 font-semibold">{p.nome}</p>
                        {p.descricao && (
                          <p className="text-xs text-ink/55">{p.descricao}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-cherryDark font-semibold">
                          {p.pontos} pts
                        </p>
                        {falta !== null && (
                          <p className="text-xs text-ink/55">
                            {podeResgatar ? "você já pode!" : `faltam ${falta}`}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="font-body text-xs text-ink/50 mt-2">
                Para resgatar, é só falar com a Camily no WhatsApp na hora de
                fazer o pedido.
              </p>
            </>
          )}
        </section>
      </main>
      <RodapeLinks />
    </>
  );
}

/** Um cupom, com o código pronto pra copiar. */
function CartaoCupom({ cupom }: { cupom: MinhaConta["cupons"][number] }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(cupom.codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sem permissão de área de transferência: a pessoa copia na mão mesmo.
    }
  }

  return (
    <div className="bg-white/70 border border-dashed border-cherryLight rounded-xl p-3 grid gap-1 font-body text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-display text-lg text-cherryDark tracking-wide">
          {cupom.codigo}
        </span>
        <button
          onClick={copiar}
          className={`text-xs font-semibold rounded-full px-3 py-2 border transition-colors ${
            copiado
              ? "bg-green-100 text-green-800 border-green-200"
              : "text-cherryDark border-cherryLight/50 hover:bg-blush"
          }`}
        >
          {copiado ? "Copiado!" : "Copiar código"}
        </button>
      </div>
      <p className="text-ink/70">
        {cupom.tipo === "percentual"
          ? `${cupom.valor}% de desconto`
          : `${reais(cupom.valor)} de desconto`}
        {cupom.pedidoMinimo > 0 && ` · a partir de ${reais(cupom.pedidoMinimo)}`}
      </p>
      {cupom.descricao && <p className="text-ink/60 text-xs">{cupom.descricao}</p>}
      {cupom.somentePix && (
        <p className="text-xs font-semibold text-green-800">Vale pagando no Pix</p>
      )}
      <p className="text-xs text-ink/45">
        {cupom.exclusivo && "Exclusivo pra você · "}
        {cupom.expiraEm
          ? `vale até ${new Date(cupom.expiraEm).toLocaleDateString("pt-BR")}`
          : "sem prazo pra usar"}
      </p>
    </div>
  );
}
