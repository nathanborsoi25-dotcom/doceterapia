"use client";

import { useEffect, useState } from "react";
import CampoNumero from "@/components/CampoNumero";
import VoltarAoPainel from "@/components/VoltarAoPainel";
import EscolherFoto from "@/components/EscolherFoto";
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
  expiraEm: string | null;
  limiteUsos: number;
  usos: number;
  ativo: boolean;
};

type Banner = {
  bannerAtivo: boolean;
  bannerTitulo: string;
  bannerDescricao: string;
  bannerSelo: string;
  bannerImagem: string;
  bannerLink: string;
};

export default function AdminPromocoesPage() {
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [salvandoBanner, setSalvandoBanner] = useState(false);
  const [aviso, setAviso] = useState("");

  const [novo, setNovo] = useState({
    codigo: "",
    descricao: "",
    tipo: "percentual",
    clienteId: "",
    expiraEm: "",
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
      .then(setBanner)
      .catch(() => setBanner(null));
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
          expiraEm: novo.expiraEm || null,
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

  async function salvarBanner() {
    if (!banner) return;
    setSalvandoBanner(true);
    try {
      const atual = await fetch("/api/config-loja").then((r) => r.json());
      await fetch("/api/config-loja", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...atual, ...banner }),
      });
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

      {/* ---------------- Banner da página inicial ---------------- */}
      <h2 className="font-display text-xl text-cherryDark mt-6">
        Destaque do cardápio
      </h2>
      <p className="text-sm font-body text-ink/60">
        Aparece no topo do cardápio, antes dos doces.
      </p>

      {banner && (
        <div className="bg-white/70 border border-cherryLight/30 rounded-2xl p-4 mt-3 grid gap-3">
          <label className="flex items-center gap-2 font-body text-sm">
            <input
              type="checkbox"
              checked={banner.bannerAtivo}
              onChange={(e) => setBanner({ ...banner, bannerAtivo: e.target.checked })}
              className="w-5 h-5 accent-cherryDark"
            />
            Mostrar o destaque no site
          </label>

          <Campo
            label="Título"
            valor={banner.bannerTitulo}
            onChange={(v) => setBanner({ ...banner, bannerTitulo: v })}
            placeholder="Combo Dia das Mães"
          />
          <Campo
            label="Descrição"
            valor={banner.bannerDescricao}
            onChange={(v) => setBanner({ ...banner, bannerDescricao: v })}
            placeholder="Uma torta + 12 brigadeiros por um preço especial"
          />
          <Campo
            label="Selo de urgência (opcional)"
            valor={banner.bannerSelo}
            onChange={(v) => setBanner({ ...banner, bannerSelo: v })}
            placeholder="Só até domingo!"
          />
          <EscolherFoto
            valor={banner.bannerImagem}
            onChange={(url) => setBanner({ ...banner, bannerImagem: url })}
          />

          <button
            onClick={salvarBanner}
            disabled={salvandoBanner}
            className="bg-cherryDark text-white rounded-full py-3 font-body font-semibold disabled:opacity-50"
          >
            {salvandoBanner ? "Salvando..." : "Salvar destaque"}
          </button>
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
          <label className="grid gap-1 text-sm font-body text-ink/80">
            Para quem vale
            <select
              value={novo.clienteId}
              onChange={(e) => setNovo({ ...novo, clienteId: e.target.value })}
              className="w-full border border-cherryLight/50 rounded-xl p-2.5 bg-white/70"
            >
              <option value="">Todos os clientes</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  Só para {c.nome}
                </option>
              ))}
            </select>
          </label>
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

        <Campo
          label="Vence em (opcional)"
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
            <p className="text-xs text-ink/50">
              {c.clienteNome ? `Só para ${c.clienteNome}` : "Todos os clientes"}
              {c.pedidoMinimo > 0 && ` · mínimo R$ ${c.pedidoMinimo.toFixed(2)}`}
              {c.limiteUsos > 0
                ? ` · usado ${c.usos}/${c.limiteUsos}`
                : ` · usado ${c.usos}×`}
              {c.expiraEm && ` · vence ${new Date(c.expiraEm).toLocaleDateString("pt-BR")}`}
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
