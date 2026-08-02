"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CampoNumero from "@/components/CampoNumero";
import GaleriaFotos from "@/components/GaleriaFotos";
import { upsertProduto } from "@/lib/api";
import type { Produto, TipoDisponibilidade } from "@/lib/types";

export default function NovoProdutoPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    sabor: "",
    disponibilidade: "pronta_entrega" as TipoDisponibilidade,
  });
  // A primeira foto da galeria é a capa que vai pro cardápio.
  const [fotos, setFotos] = useState<string[]>([]);
  // Números ficam separados do resto do formulário porque podem estar
  // "vazios" (null) enquanto ela ainda não digitou.
  const [preco, setPreco] = useState<number | null>(null);
  const [custo, setCusto] = useState<number | null>(null);
  const [prazoDias, setPrazoDias] = useState<number | null>(null);
  const [estoque, setEstoque] = useState<number | null>(null);

  const [salvando, setSalvando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const produto: Produto = {
      id: crypto.randomUUID(),
      nome: form.nome,
      descricao: form.descricao,
      sabor: form.sabor,
      preco: preco ?? 0,
      custo: custo ?? 0,
      fotoUrl: fotos[0] ?? "",
      fotos,
      disponibilidade: form.disponibilidade,
      prazoDias: prazoDias ? Math.round(prazoDias) : undefined,
      // Vazio = sem controle de estoque; zero = já nasce esgotado.
      estoque: estoque == null ? null : Math.round(estoque),
      ativo: true,
    };
    setSalvando(true);
    try {
      await upsertProduto(produto);
      router.push("/admin/produtos");
    } catch {
      setSalvando(false);
    }
  }

  return (
    <main className="min-h-screen px-4 sm:px-6 md:px-12 py-8 md:py-10 max-w-lg mx-auto">
      <h1 className="font-display text-2xl sm:text-3xl text-cherryDark">Novo produto</h1>
      <form onSubmit={handleSubmit} className="grid gap-3 mt-6">
        <input
          required
          placeholder="Nome do doce"
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
          className="w-full border border-cherryLight/50 rounded-lg p-2.5 font-body"
        />
        <textarea
          required
          placeholder="Descrição"
          value={form.descricao}
          onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          className="w-full border border-cherryLight/50 rounded-lg p-2.5 font-body"
        />
        <input
          required
          placeholder="Sabor"
          value={form.sabor}
          onChange={(e) => setForm({ ...form, sabor: e.target.value })}
          className="w-full border border-cherryLight/50 rounded-lg p-2.5 font-body"
        />
        <label className="grid gap-1 text-sm font-body text-ink/80">
          Preço de venda (R$) *
          <CampoNumero
            required
            valor={preco}
            onChange={setPreco}
            placeholder="35,00"
            className="w-full border border-cherryLight/50 rounded-lg p-2.5 font-body"
          />
        </label>
        {/* Sem o custo as métricas só mostram faturamento, nunca lucro. */}
        <label className="grid gap-1 text-sm font-body text-ink/80">
          Custo de produção (R$)
          <CampoNumero
            valor={custo}
            onChange={setCusto}
            placeholder="12,50"
            className="w-full border border-cherryLight/50 rounded-lg p-2.5 font-body"
          />
          <span className="text-xs text-ink/50">
            Quanto você gasta pra fazer um. É o que permite ver o lucro nas
            métricas — dá pra preencher depois.
          </span>
        </label>
        <label className="grid gap-1 text-sm font-body text-ink/80">
          Estoque — quantas unidades você tem
          <CampoNumero
            valor={estoque}
            onChange={setEstoque}
            casas={0}
            placeholder="deixe vazio para não controlar"
            className="w-full border border-cherryLight/50 rounded-lg p-2.5 font-body"
          />
          <span className="text-xs text-ink/50">
            Se preencher, o cardápio mostra a faixa de <strong>esgotado</strong>{" "}
            quando chegar a zero. Deixando vazio, o doce fica sempre disponível.
          </span>
        </label>

        <GaleriaFotos fotos={fotos} onChange={setFotos} />
        <select
          value={form.disponibilidade}
          onChange={(e) => setForm({ ...form, disponibilidade: e.target.value as TipoDisponibilidade })}
          className="w-full border border-cherryLight/50 rounded-lg p-2.5 font-body"
        >
          <option value="pronta_entrega">Pronta entrega</option>
          <option value="sob_encomenda">Sob encomenda</option>
        </select>
        {form.disponibilidade === "sob_encomenda" && (
          <CampoNumero
            valor={prazoDias}
            onChange={setPrazoDias}
            casas={0}
            placeholder="Prazo em dias"
            aria-label="Prazo em dias"
            className="w-full border border-cherryLight/50 rounded-lg p-2.5 font-body"
          />
        )}
        <button
          disabled={salvando}
          className="bg-cherryDark text-white rounded-full py-3 font-body font-semibold mt-2 disabled:opacity-50"
        >
          {salvando ? "Salvando..." : "Salvar produto"}
        </button>
      </form>
    </main>
  );
}
