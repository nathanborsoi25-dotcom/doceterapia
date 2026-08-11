"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import CherryDivider from "@/components/CherryDivider";
import RodapeLinks from "@/components/RodapeLinks";
import { bannersVisiveis, type BannerDaLoja } from "@/lib/banners";
import { percentualDoPix, percentualEscrito } from "@/lib/desconto-pix";
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
export default function PromocoesPage() {
  const [banners, setBanners] = useState<BannerDaLoja[]>([]);
  const [percentualPix, setPercentualPix] = useState(0);
  const [conta, setConta] = useState<MinhaConta | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    fetch("/api/config-loja", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => {
        setBanners(bannersVisiveis(c));
        setPercentualPix(percentualDoPix(c?.descontoPix));
      })
      .catch(() => setBanners([]))
      .finally(() => setCarregando(false));

    // Sem conta isso falha, e tudo bem: os cupons pessoais só existem pra
    // quem entrou. O resto da tela continua valendo pra visitante.
    getMinhaConta()
      .then(setConta)
      .catch(() => setConta(null));
  }, []);

  const cupons = conta?.cupons ?? [];
  const vazia = !carregando && banners.length === 0 && percentualPix <= 0 && cupons.length === 0;

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

        {/* O desconto do Pix vale pra todo mundo, sem código — por isso vem
            antes dos cupons, que dependem de ter ganhado um. */}
        {percentualPix > 0 && (
          <section className="bg-white/70 border border-cherryLight/40 rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-3">
              <span className="text-3xl" aria-hidden="true">
                💸
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-xl text-cherryDark">
                  {percentualEscrito(percentualPix)} de desconto no Pix
                </h2>
                <p className="font-body text-sm text-ink/70 mt-1">
                  Vale pra todo mundo, sem cupom nenhum: é só escolher
                  &ldquo;Pagar com Pix&rdquo; na hora de fechar o pedido, e o
                  desconto já entra no valor.
                </p>
              </div>
            </div>
          </section>
        )}

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
