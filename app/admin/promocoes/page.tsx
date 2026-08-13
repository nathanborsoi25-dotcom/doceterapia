"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AvisoSalvo from "@/components/AvisoSalvo";
import CampoNumero from "@/components/CampoNumero";
import VoltarAoPainel from "@/components/VoltarAoPainel";
import EscolherFoto from "@/components/EscolherFoto";
import { useAvisoSalvo } from "@/lib/usar-aviso-salvo";
import {
  bannerVazio,
  bannersDaLoja,
  MAXIMO_BANNERS,
  type BannerDaLoja,
} from "@/lib/banners";
import { percentualDoPix } from "@/lib/desconto-pix";
import { reais } from "@/lib/formato";
import type { Cliente } from "@/lib/types";

type Cupom = {
  id: string;
  codigo: string;
  descricao: string;
  tipo: string;
  valor: number;
  pedidoMinimo: number;
  clienteId: string | null;
  /** Ids e nomes de quem pode usar. Vazio = a loja toda. */
  clientesIds: string[];
  clientesNomes: string[];
  secreto: boolean;
  expiraEm: string | null;
  limiteUsos: number;
  usos: number;
  ativo: boolean;
};

/** Já passou da data? Vale para o selo "vencido" da lista do painel. */
function venceu(expiraEm: string | null): boolean {
  return !!expiraEm && new Date(expiraEm).getTime() < Date.now();
}

/**
 * Quem pode usar o cupom, escrito. Com muita gente escolhida a lista fica
 * ilegível, então a partir de três pessoas vira "Fulana, Beltrana e mais 4".
 */
function quemPodeUsar(c: Cupom): string {
  const nomes = c.clientesNomes ?? [];
  if (nomes.length === 0) return "Todos os clientes";
  if (nomes.length === 1) return `Só para ${nomes[0]}`;
  if (nomes.length <= 3) return `Só para ${nomes.join(", ")}`;
  return `Só para ${nomes.slice(0, 2).join(", ")} e mais ${nomes.length - 2}`;
}

export default function AdminPromocoesPage() {
  const router = useRouter();
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [banners, setBanners] = useState<BannerDaLoja[] | null>(null);
  const [salvandoBanner, setSalvandoBanner] = useState(false);
  const [bannerSalvo, setBannerSalvo] = useState(false);
  const [aviso, setAviso] = useState("");

  /** Desconto automático de quem paga no Pix, em %. Zero desliga. */
  const [descontoPix, setDescontoPix] = useState<number | null>(null);
  const [salvandoPix, setSalvandoPix] = useState(false);
  const { aviso: avisoSalvo, avisarErro } = useAvisoSalvo();
  const [pixSalvo, setPixSalvo] = useState(false);

  const [novo, setNovo] = useState({
    codigo: "",
    descricao: "",
    tipo: "percentual",
    expiraEm: "",
    /** Cupom secreto: só quem receber o código consegue usar. */
    secreto: false,
  });
  /** Quem pode usar o cupom. Lista vazia = a loja toda. */
  const [clientesEscolhidos, setClientesEscolhidos] = useState<string[]>([]);
  // Os números do cupom ficam separados: podem estar vazios enquanto ela
  // digita, e vazio não é a mesma coisa que zero.
  const [valor, setValor] = useState<number | null>(null);
  const [pedidoMinimo, setPedidoMinimo] = useState<number | null>(null);
  const [limiteUsos, setLimiteUsos] = useState<number | null>(null);
  const [criando, setCriando] = useState(false);

  function carregar() {
    fetch("/api/cupons", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setCupons)
      .catch(() => setCupons([]));
  }

  useEffect(() => {
    carregar();
    fetch("/api/clientes", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setClientes)
      .catch(() => setClientes([]));
    fetch("/api/config-loja", { cache: "no-store" })
      .then((r) => r.json())
      .then((config) => {
        setBanners(bannersDaLoja(config));
        setDescontoPix(percentualDoPix(config?.descontoPix));
      })
      .catch(() => setBanners([]));
  }, []);

  /** Salva só o percentual: a rota preserva o resto da configuração. */
  async function salvarDescontoPix() {
    setSalvandoPix(true);
    setPixSalvo(false);
    try {
      const r = await fetch("/api/config-loja", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descontoPix: descontoPix ?? 0 }),
      });
      // Sem esta conferência o botão dizia "Salvo ✓" mesmo quando o servidor
      // recusava — e o desconto continuava o antigo, sem ninguém saber.
      if (!r.ok) throw new Error("recusado");
      router.refresh();
      setPixSalvo(true);
      setTimeout(() => setPixSalvo(false), 3000);
    } catch {
      avisarErro("Não consegui salvar o desconto do Pix. Tenta de novo?");
    } finally {
      setSalvandoPix(false);
    }
  }

  async function criarCupom(e: React.FormEvent) {
    e.preventDefault();
    setAviso("");
    setCriando(true);
    try {
      const res = await fetch("/api/cupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...novo,
          valor: valor ?? 0,
          pedidoMinimo: pedidoMinimo ?? 0,
          limiteUsos: Math.round(limiteUsos ?? 0),
          clientesIds: clientesEscolhidos,
        }),
      });
      const corpo = await res.json();
      if (!res.ok) {
        setAviso(corpo.error ?? "Não foi possível criar o cupom.");
        return;
      }
      setNovo({
        codigo: "",
        descricao: "",
        tipo: "percentual",
        expiraEm: "",
        secreto: false,
      });
      setClientesEscolhidos([]);
      setValor(null);
      setPedidoMinimo(null);
      setLimiteUsos(null);
      carregar();
    } finally {
      setCriando(false);
    }
  }

  async function alternar(c: Cupom) {
    setCupons((prev) =>
      prev.map((x) => (x.id === c.id ? { ...x, ativo: !x.ativo } : x))
    );
    await fetch(`/api/cupons/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !c.ativo }),
    });
  }

  function adicionarBanner() {
    setBanners((prev) => [...(prev ?? []), bannerVazio()]);
    setBannerSalvo(false);
  }

  function removerBanner(id: string) {
    setBanners((prev) => (prev ?? []).filter((b) => b.id !== id));
    setBannerSalvo(false);
  }

  /** Troca de lugar com o vizinho — é assim que ela escolhe qual vem antes. */
  function moverBanner(indice: number, direcao: -1 | 1) {
    setBanners((prev) => {
      const lista = [...(prev ?? [])];
      const destino = indice + direcao;
      if (destino < 0 || destino >= lista.length) return lista;
      [lista[indice], lista[destino]] = [lista[destino], lista[indice]];
      return lista;
    });
    setBannerSalvo(false);
  }

  /** Muda um campo de um banner sem mexer nos outros. */
  function mudarBanner(id: string, campo: keyof BannerDaLoja, valor: string | boolean) {
    setBanners((prev) =>
      (prev ?? []).map((b) => (b.id === id ? { ...b, [campo]: valor } : b))
    );
    setBannerSalvo(false);
  }

  /**
   * Salva só o campo `banners`: a rota preserva o que não vier no corpo, e
   * mandar a configuração inteira de volta arriscaria sobrescrever o que
   * outra tela do painel gravou no meio tempo.
   */
  async function salvarBanners() {
    if (!banners) return;
    setSalvandoBanner(true);
    setBannerSalvo(false);
    try {
      const r = await fetch("/api/config-loja", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banners }),
      });
      if (!r.ok) throw new Error("recusado");
      // Limpa o que o navegador guardou das telas do cliente: sem isso ela
      // vai ver o banner antigo ao sair daqui e voltar pelo menu.
      router.refresh();
      setBannerSalvo(true);
      setTimeout(() => setBannerSalvo(false), 3000);
    } catch {
      avisarErro("Não consegui salvar os banners. Tenta de novo?");
    } finally {
      setSalvandoBanner(false);
    }
  }

  return (
    <main className="min-h-screen px-4 sm:px-6 md:px-12 py-8 md:py-10 max-w-3xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl sm:text-3xl text-cherryDark">Promoções</h1>
        <VoltarAoPainel />
      </div>

      {/* ---------------- Desconto do Pix ---------------- */}
      <h2 className="font-display text-xl text-cherryDark mt-6">
        Desconto de quem paga no Pix
      </h2>
      <p className="text-sm font-body text-ink/60">
        Vale pra todo mundo, sem cupom nenhum: aparece já no botão de pagar.
      </p>

      <div className="bg-white/70 border border-cherryLight/30 rounded-2xl p-4 mt-3 grid gap-3">
        <label className="grid gap-1 text-sm font-body text-ink/80">
          Desconto no Pix (%) — zero desliga
          <div className="flex flex-wrap items-center gap-2">
            <CampoNumero
              valor={descontoPix}
              onChange={(v) => {
                setDescontoPix(v);
                setPixSalvo(false);
              }}
              placeholder="4"
              className="w-full sm:w-32 border border-cherryLight/50 rounded-xl p-2.5 bg-white/70"
            />
            <button
              onClick={salvarDescontoPix}
              disabled={salvandoPix}
              className={`rounded-full px-5 py-3 font-body font-semibold text-white disabled:opacity-50 ${
                pixSalvo ? "bg-green-600" : "bg-cherryDark"
              }`}
            >
              {salvandoPix ? "Salvando..." : pixSalvo ? "Salvo ✓" : "Salvar"}
            </button>
          </div>
        </label>

        {/* O número que decide se o desconto vale a pena. Sem ele, é chute. */}
        <p className="text-xs font-body text-ink/55 bg-blush/40 border border-cherryLight/30 rounded-xl px-3 py-2.5">
          O Pix te custa <strong>0,99%</strong> e o cartão <strong>4,98%</strong>.
          Numa venda de R$ 100 você fica com{" "}
          <strong>{reais(100 * (1 - (descontoPix ?? 0) / 100) * 0.9901)}</strong> dando
          esse desconto no Pix, contra <strong>{reais(95.02)}</strong> no cartão.
          {(descontoPix ?? 0) > 4
            ? " Acima de 4% você recebe menos do que receberia no cartão."
            : " E o dinheiro do Pix cai na hora."}
        </p>
      </div>

      {/* ---------------- Destaques do cardápio ---------------- */}
      <h2 className="font-display text-xl text-cherryDark mt-6">
        Destaques do cardápio
      </h2>
      <p className="text-sm font-body text-ink/60">
        Aparecem no topo do cardápio, antes dos doces. Com mais de um, a
        cliente arrasta de lado para ver os outros.
      </p>

      {banners === null && (
        <p className="text-ink/60 font-body text-sm mt-3">Carregando os destaques...</p>
      )}

      {banners && (
        <div className="grid gap-3 mt-3">
          {banners.length === 0 && (
            <p className="text-sm font-body text-ink/60 bg-white/60 border border-cherryLight/30 rounded-2xl px-4 py-3">
              Nenhum destaque ainda. Crie um para anunciar um combo, uma data
              especial ou o desconto do Pix. 🍒
            </p>
          )}

          {banners.map((b, i) => (
            <div
              key={b.id}
              className={`border rounded-2xl p-4 grid gap-3 ${
                b.ativo ? "bg-white/70 border-cherryLight/30" : "bg-ink/5 border-ink/10"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-display text-base text-cherryDark">
                  {i + 1}º destaque
                  {!b.ativo && (
                    <span className="font-body text-xs text-ink/50"> · escondido</span>
                  )}
                </span>
                <div className="flex items-center gap-1">
                  {/* Ordem: é ela que decide o que a cliente vê primeiro. */}
                  <button
                    type="button"
                    onClick={() => moverBanner(i, -1)}
                    disabled={i === 0}
                    aria-label="Subir este destaque"
                    className="w-11 h-11 rounded-full text-cherryDark disabled:opacity-25"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moverBanner(i, 1)}
                    disabled={i === banners.length - 1}
                    aria-label="Descer este destaque"
                    className="w-11 h-11 rounded-full text-cherryDark disabled:opacity-25"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removerBanner(b.id)}
                    className="text-xs font-body text-ink/50 underline px-2 min-h-[44px]"
                  >
                    remover
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 font-body text-sm">
                <input
                  type="checkbox"
                  checked={b.ativo}
                  onChange={(e) => mudarBanner(b.id, "ativo", e.target.checked)}
                  className="w-5 h-5 accent-cherryDark"
                />
                Mostrar no site
              </label>

              {/* A arte é o destaque inteiro: o texto da promoção já vem
                  escrito nela, então o site não escreve nada por cima nem por
                  baixo. */}
              <EscolherFoto
                valor={b.imagem}
                onChange={(url) => mudarBanner(b.id, "imagem", url)}
                label="Arte do destaque"
                previa="banner"
              />

              <Campo
                label="Nome (só pra você se achar aqui)"
                valor={b.titulo}
                onChange={(v) => mudarBanner(b.id, "titulo", v)}
                placeholder="Combo Dia das Mães"
              />
              <Campo
                label="Para onde leva o toque"
                valor={b.link}
                onChange={(v) => mudarBanner(b.id, "link", v)}
                placeholder="/catalogo"
              />
            </div>
          ))}

          <div className="flex flex-wrap gap-2">
            {banners.length < MAXIMO_BANNERS && (
              <button
                type="button"
                onClick={adicionarBanner}
                className="flex-1 min-w-[12rem] border-2 border-dashed border-cherryLight/60 text-cherryDark rounded-full py-3 font-body font-semibold hover:bg-blush/40"
              >
                + Adicionar destaque
              </button>
            )}
            <button
              onClick={salvarBanners}
              disabled={salvandoBanner}
              className={`flex-1 min-w-[12rem] rounded-full py-3 font-body font-semibold text-white disabled:opacity-50 ${
                bannerSalvo ? "bg-green-600" : "bg-cherryDark"
              }`}
            >
              {salvandoBanner
                ? "Salvando..."
                : bannerSalvo
                  ? "Salvo ✓"
                  : "Salvar destaques"}
            </button>
          </div>
          <p className="text-xs font-body text-ink/45">
            Até {MAXIMO_BANNERS} destaques. Destaque sem título e sem foto não
            é salvo.
          </p>
        </div>
      )}

      {/* ---------------- Cupons ---------------- */}
      <h2 className="font-display text-xl text-cherryDark mt-8">Cupons de desconto</h2>

      <form
        onSubmit={criarCupom}
        className="bg-white/70 border border-cherryLight/30 rounded-2xl p-4 mt-3 grid gap-3"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Campo
            label="Código *"
            valor={novo.codigo}
            onChange={(v) => setNovo({ ...novo, codigo: v.toUpperCase() })}
            placeholder="VOLTASEMPRE"
          />
          <label className="grid gap-1 text-sm font-body text-ink/80">
            Tipo de desconto
            <select
              value={novo.tipo}
              onChange={(e) => setNovo({ ...novo, tipo: e.target.value })}
              className="w-full border border-cherryLight/50 rounded-xl p-2.5 bg-white/70"
            >
              <option value="percentual">Porcentagem (%)</option>
              <option value="valor">Valor fixo (R$)</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="grid gap-1 text-sm font-body text-ink/80">
            {novo.tipo === "percentual" ? "Desconto (%) *" : "Desconto (R$) *"}
            <CampoNumero
              valor={valor}
              onChange={setValor}
              placeholder={novo.tipo === "percentual" ? "10" : "5,00"}
              className={ESTILO_CAMPO}
            />
          </label>
          <label className="grid gap-1 text-sm font-body text-ink/80">
            Pedido mínimo (R$)
            <CampoNumero
              valor={pedidoMinimo}
              onChange={setPedidoMinimo}
              placeholder="0"
              className={ESTILO_CAMPO}
            />
          </label>
        </div>

        <Campo
          label="Descrição (o cliente vê)"
          valor={novo.descricao}
          onChange={(v) => setNovo({ ...novo, descricao: v })}
          placeholder="10% de desconto na sua próxima compra"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <BuscaCliente
            clientes={clientes}
            escolhidos={clientesEscolhidos}
            onMudar={setClientesEscolhidos}
          />
          <label className="grid gap-1 text-sm font-body text-ink/80">
            Limite de usos (0 = ilimitado)
            <CampoNumero
              valor={limiteUsos}
              onChange={setLimiteUsos}
              casas={0}
              placeholder="0"
              className={ESTILO_CAMPO}
            />
          </label>
        </div>

        {/* Obrigatório: cupom sem prazo fica valendo pra sempre e ninguém
            lembra de desligar. */}
        <Campo
          label="Vence em *"
          valor={novo.expiraEm}
          onChange={(v) => setNovo({ ...novo, expiraEm: v })}
          tipo="date"
        />

        {/* Cupom secreto: não se anuncia, você é quem entrega o código. */}
        <label className="flex items-start gap-2 font-body text-sm bg-blush/40 border border-cherryLight/40 rounded-xl px-3 py-2.5">
          <input
            type="checkbox"
            checked={novo.secreto}
            onChange={(e) => setNovo({ ...novo, secreto: e.target.checked })}
            className="w-5 h-5 accent-cherryDark mt-0.5"
          />
          <span>
            Cupom secreto
            <span className="block text-xs text-ink/55">
              Não aparece em &ldquo;Cupons disponíveis&rdquo; na conta de
              ninguém. Só funciona pra quem digitar o código — você manda pra
              quem quiser, no WhatsApp ou nos stories.
            </span>
          </span>
        </label>

        {aviso && <p className="text-sm text-cherryDark font-body">{aviso}</p>}

        <button
          disabled={criando}
          className="bg-cherryDark text-white rounded-full py-3 font-body font-semibold disabled:opacity-50"
        >
          {criando ? "Criando..." : "Criar cupom"}
        </button>
      </form>

      <div className="grid gap-2 mt-4">
        {cupons.length === 0 && (
          <p className="text-ink/60 font-body text-sm">Nenhum cupom criado ainda.</p>
        )}
        {cupons.map((c) => (
          <div
            key={c.id}
            className={`border rounded-xl p-3 font-body text-sm grid gap-1 ${
              c.ativo ? "bg-white/70 border-cherryLight/30" : "bg-ink/5 border-ink/10 opacity-70"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-display text-base text-cherryDark tracking-wide">
                {c.codigo}
              </span>
              <span className="font-semibold text-ink/80">
                {c.tipo === "percentual"
                  ? `${c.valor}% off`
                  : `R$ ${c.valor.toFixed(2)} off`}
              </span>
            </div>
            {c.descricao && <p className="text-ink/70">{c.descricao}</p>}
            <div className="flex flex-wrap gap-1.5">
              {c.secreto && (
                <span className="text-[11px] font-semibold bg-cherryDark/10 text-cherryDark rounded-full px-2 py-0.5">
                  🤫 secreto
                </span>
              )}
              {/* Vencido some da tela do cliente, mas aqui você precisa ver. */}
              {venceu(c.expiraEm) && (
                <span className="text-[11px] font-semibold bg-ink/10 text-ink/60 rounded-full px-2 py-0.5">
                  vencido
                </span>
              )}
            </div>
            <p className="text-xs text-ink/50">
              {quemPodeUsar(c)}
              {c.pedidoMinimo > 0 && ` · mínimo R$ ${c.pedidoMinimo.toFixed(2)}`}
              {c.limiteUsos > 0
                ? ` · usado ${c.usos}/${c.limiteUsos}`
                : ` · usado ${c.usos}×`}
              {c.expiraEm &&
                ` · ${venceu(c.expiraEm) ? "venceu" : "vence"} ${new Date(c.expiraEm).toLocaleDateString("pt-BR")}`}
            </p>
            <button
              onClick={() => alternar(c)}
              className="justify-self-start text-xs font-semibold text-cherryDark underline py-3 px-1"
            >
              {c.ativo ? "Desativar" : "Reativar"}
            </button>
          </div>
        ))}
      </div>

      <AvisoSalvo aviso={avisoSalvo} />
    </main>
  );
}

const ESTILO_CAMPO =
  "w-full border border-cherryLight/50 rounded-xl p-2.5 bg-white/70 focus:outline-none focus:ring-2 focus:ring-cherryDark";

/**
 * Para quem o cupom vale.
 *
 * Era uma lista suspensa com TODOS os clientes — com a loja crescendo, achar
 * alguém ali vira rolagem infinita no celular. Agora ela digita o começo do
 * nome e escolhe **quantos quiser**: dá pra montar um cupom para três
 * clientes específicos sem criar três códigos diferentes. Nenhum escolhido
 * quer dizer "vale para a loja toda".
 */
function BuscaCliente({
  clientes,
  escolhidos,
  onMudar,
}: {
  clientes: Cliente[];
  escolhidos: string[];
  onMudar: (ids: string[]) => void;
}) {
  const [busca, setBusca] = useState("");

  const achados = useMemo(() => {
    const termo = busca
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
    if (!termo) return [];
    return clientes
      .filter((c) => !escolhidos.includes(c.id))
      .filter((c) =>
        `${c.nome} ${c.email}`
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toLowerCase()
          .includes(termo)
      )
      .slice(0, 6);
  }, [clientes, busca, escolhidos]);

  const todos = escolhidos.length === 0;

  return (
    <div className="grid gap-1.5 text-sm font-body text-ink/80">
      Para quem vale
      {/* Quem já foi escolhido, cada um com o seu "×". */}
      {escolhidos.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {escolhidos.map((id) => {
            const c = clientes.find((x) => x.id === id);
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 bg-blush/70 border border-cherryDark/30 rounded-full pl-3 pr-1 py-1 text-xs text-cherryDark"
              >
                <span className="max-w-[10rem] truncate">{c?.nome ?? "cliente"}</span>
                <button
                  type="button"
                  onClick={() => onMudar(escolhidos.filter((x) => x !== id))}
                  aria-label={`Tirar ${c?.nome ?? "cliente"} do cupom`}
                  className="w-7 h-7 rounded-full text-cherryDark/70 hover:text-cherryDark"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}
      <input
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder={
          todos ? "Todos os clientes — ou digite um nome" : "Adicionar mais alguém"
        }
        aria-label="Procurar cliente para o cupom"
        className={ESTILO_CAMPO}
      />
      {busca.trim() && (
        <div className="grid gap-1">
          {achados.length === 0 ? (
            <span className="text-xs text-ink/50">
              Nenhum cliente com esse nome — ou já está na lista.
            </span>
          ) : (
            achados.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onMudar([...escolhidos, c.id]);
                  setBusca("");
                }}
                className="text-left text-sm border border-cherryLight/40 rounded-xl px-3 py-2.5 bg-white/70 hover:border-cherryDark"
              >
                <span className="block truncate">{c.nome}</span>
                <span className="block truncate text-xs text-ink/45">{c.email}</span>
              </button>
            ))
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            onMudar(clientes.map((c) => c.id));
            setBusca("");
          }}
          className="text-xs font-body text-cherryDark underline min-h-[44px] px-1"
        >
          Escolher todos ({clientes.length})
        </button>
        {escolhidos.length > 0 && (
          <button
            type="button"
            onClick={() => {
              onMudar([]);
              setBusca("");
            }}
            className="text-xs font-body text-ink/50 underline min-h-[44px] px-1"
          >
            limpar
          </button>
        )}
      </div>
      <span className="text-xs text-ink/50">
        {todos
          ? "Sem ninguém escolhido, o cupom vale para a loja toda."
          : `${escolhidos.length} ${escolhidos.length === 1 ? "cliente escolhido" : "clientes escolhidos"} — só eles conseguem usar.`}
      </span>
    </div>
  );
}

function Campo({
  label,
  valor,
  onChange,
  placeholder,
  tipo = "text",
}: {
  label: string;
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  tipo?: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-body text-ink/80">
      {label}
      <input
        type={tipo}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={ESTILO_CAMPO}
      />
    </label>
  );
}
