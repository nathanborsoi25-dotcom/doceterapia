"use client";

import { useEffect, useMemo, useState } from "react";
import CampoNumero from "@/components/CampoNumero";
import VoltarAoPainel from "@/components/VoltarAoPainel";
import EscolherFoto from "@/components/EscolherFoto";
import {
  bannerVazio,
  bannersDaLoja,
  MAXIMO_BANNERS,
  type BannerDaLoja,
} from "@/lib/banners";
import type { Cliente } from "@/lib/types";

type Cupom = {
  id: string;
  codigo: string;
  descricao: string;
  tipo: string;
  valor: number;
  pedidoMinimo: number;
  clienteId: string | null;
  clienteNome: string | null;
  somentePix: boolean;
  expiraEm: string | null;
  limiteUsos: number;
  usos: number;
  ativo: boolean;
};

/** Já passou da data? Vale para o selo "vencido" da lista do painel. */
function venceu(expiraEm: string | null): boolean {
  return !!expiraEm && new Date(expiraEm).getTime() < Date.now();
}

export default function AdminPromocoesPage() {
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [banners, setBanners] = useState<BannerDaLoja[] | null>(null);
  const [salvandoBanner, setSalvandoBanner] = useState(false);
  const [bannerSalvo, setBannerSalvo] = useState(false);
  const [aviso, setAviso] = useState("");

  const [novo, setNovo] = useState({
    codigo: "",
    descricao: "",
    tipo: "percentual",
    clienteId: "",
    expiraEm: "",
    somentePix: false,
  });
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
      .then((config) => setBanners(bannersDaLoja(config)))
      .catch(() => setBanners([]));
  }, []);

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
          clienteId: novo.clienteId || null,
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
        clienteId: "",
        expiraEm: "",
        somentePix: false,
      });
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
      await fetch("/api/config-loja", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banners }),
      });
      setBannerSalvo(true);
      setTimeout(() => setBannerSalvo(false), 3000);
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

              <Campo
                label="Título"
                valor={b.titulo}
                onChange={(v) => mudarBanner(b.id, "titulo", v)}
                placeholder="Combo Dia das Mães"
              />
              <Campo
                label="Descrição"
                valor={b.descricao}
                onChange={(v) => mudarBanner(b.id, "descricao", v)}
                placeholder="Uma torta + 12 brigadeiros por um preço especial"
              />
              <Campo
                label="Selo de urgência (opcional)"
                valor={b.selo}
                onChange={(v) => mudarBanner(b.id, "selo", v)}
                placeholder="Só até domingo!"
              />
              <Campo
                label="Para onde leva o toque"
                valor={b.link}
                onChange={(v) => mudarBanner(b.id, "link", v)}
                placeholder="/catalogo"
              />
              <EscolherFoto
                valor={b.imagem}
                onChange={(url) => mudarBanner(b.id, "imagem", url)}
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

        {/* Desconto só no Pix: a diferença de taxa (0,99% contra 4,98%) é o
            que faz o desconto se pagar. */}
        <label className="flex items-start gap-2 font-body text-sm bg-blush/40 border border-cherryLight/40 rounded-xl px-3 py-2.5">
          <input
            type="checkbox"
            checked={novo.somentePix}
            onChange={(e) => setNovo({ ...novo, somentePix: e.target.checked })}
            className="w-5 h-5 accent-cherryDark mt-0.5"
          />
          <span>
            Vale só pagando no Pix
            <span className="block text-xs text-ink/55">
              Com isso marcado, o Mercado Pago só oferece Pix nesse pedido. O
              Pix te custa 0,99%, o cartão 4,98% — é o que faz o desconto valer
              a pena.
            </span>
          </span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <BuscaCliente
            clientes={clientes}
            escolhidoId={novo.clienteId}
            onEscolher={(id) => setNovo({ ...novo, clienteId: id })}
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
              {c.somentePix && (
                <span className="text-[11px] font-semibold bg-green-100 text-green-800 rounded-full px-2 py-0.5">
                  só no Pix
                </span>
              )}
              {/* Vencido some da tela da cliente, mas aqui ela precisa ver. */}
              {venceu(c.expiraEm) && (
                <span className="text-[11px] font-semibold bg-ink/10 text-ink/60 rounded-full px-2 py-0.5">
                  vencido
                </span>
              )}
            </div>
            <p className="text-xs text-ink/50">
              {c.clienteNome ? `Só para ${c.clienteNome}` : "Todos os clientes"}
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
    </main>
  );
}

const ESTILO_CAMPO =
  "w-full border border-cherryLight/50 rounded-xl p-2.5 bg-white/70 focus:outline-none focus:ring-2 focus:ring-cherryDark";

/**
 * Para quem o cupom vale.
 *
 * Era uma lista suspensa com TODAS as clientes — com a loja crescendo, achar
 * alguém ali vira rolagem infinita no celular. Agora ela digita o começo do
 * nome e escolhe. Sem nada digitado, o cupom vale para todo mundo.
 */
function BuscaCliente({
  clientes,
  escolhidoId,
  onEscolher,
}: {
  clientes: Cliente[];
  escolhidoId: string;
  onEscolher: (id: string) => void;
}) {
  const [busca, setBusca] = useState("");
  const escolhida = clientes.find((c) => c.id === escolhidoId) ?? null;

  const achados = useMemo(() => {
    const termo = busca
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
    if (!termo) return [];
    return clientes
      .filter((c) =>
        `${c.nome} ${c.email}`
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toLowerCase()
          .includes(termo)
      )
      .slice(0, 6);
  }, [clientes, busca]);

  if (escolhida) {
    return (
      <div className="grid gap-1 text-sm font-body text-ink/80">
        Para quem vale
        <div className="flex items-center justify-between gap-2 border border-cherryDark/40 bg-blush/50 rounded-xl px-3 py-2">
          <span className="min-w-0 truncate text-cherryDark font-semibold">
            Só para {escolhida.nome}
          </span>
          <button
            type="button"
            onClick={() => {
              onEscolher("");
              setBusca("");
            }}
            className="shrink-0 text-xs text-ink/50 underline min-h-[44px] px-1"
          >
            trocar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-1 text-sm font-body text-ink/80">
      Para quem vale
      <input
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Todos os clientes — ou digite um nome"
        aria-label="Procurar cliente para o cupom"
        className={ESTILO_CAMPO}
      />
      {busca.trim() && (
        <div className="grid gap-1">
          {achados.length === 0 ? (
            <span className="text-xs text-ink/50">
              Nenhuma cliente com esse nome.
            </span>
          ) : (
            achados.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onEscolher(c.id);
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
