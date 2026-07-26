"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { upsertProduto } from "@/lib/api";
import type { Produto, TipoDisponibilidade } from "@/lib/types";

export default function NovoProdutoPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    sabor: "",
    preco: "",
    fotoUrl: "",
    disponibilidade: "pronta_entrega" as TipoDisponibilidade,
    prazoDias: "",
  });

  const [salvando, setSalvando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const produto: Produto = {
      id: crypto.randomUUID(),
      nome: form.nome,
      descricao: form.descricao,
      sabor: form.sabor,
      preco: parseFloat(form.preco) || 0,
      fotoUrl: form.fotoUrl,
      disponibilidade: form.disponibilidade,
      prazoDias: form.prazoDias ? parseInt(form.prazoDias) : undefined,
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
    <main className="min-h-screen px-6 md:px-12 py-10 max-w-lg mx-auto">
      <h1 className="font-display text-3xl text-cherryDark">Novo produto</h1>
      <form onSubmit={handleSubmit} className="grid gap-3 mt-6">
        <input
          required
          placeholder="Nome do doce"
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
          className="border border-cherryLight/50 rounded-lg p-2 font-body"
        />
        <textarea
          required
          placeholder="Descrição"
          value={form.descricao}
          onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          className="border border-cherryLight/50 rounded-lg p-2 font-body"
        />
        <input
          required
          placeholder="Sabor"
          value={form.sabor}
          onChange={(e) => setForm({ ...form, sabor: e.target.value })}
          className="border border-cherryLight/50 rounded-lg p-2 font-body"
        />
        <input
          required
          type="number"
          step="0.01"
          placeholder="Preço (R$)"
          value={form.preco}
          onChange={(e) => setForm({ ...form, preco: e.target.value })}
          className="border border-cherryLight/50 rounded-lg p-2 font-body"
        />
        <input
          placeholder="URL da foto"
          value={form.fotoUrl}
          onChange={(e) => setForm({ ...form, fotoUrl: e.target.value })}
          className="border border-cherryLight/50 rounded-lg p-2 font-body"
        />
        <select
          value={form.disponibilidade}
          onChange={(e) => setForm({ ...form, disponibilidade: e.target.value as TipoDisponibilidade })}
          className="border border-cherryLight/50 rounded-lg p-2 font-body"
        >
          <option value="pronta_entrega">Pronta entrega</option>
          <option value="sob_encomenda">Sob encomenda</option>
        </select>
        {form.disponibilidade === "sob_encomenda" && (
          <input
            type="number"
            placeholder="Prazo em dias"
            value={form.prazoDias}
            onChange={(e) => setForm({ ...form, prazoDias: e.target.value })}
            className="border border-cherryLight/50 rounded-lg p-2 font-body"
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
