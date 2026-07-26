"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CherryDivider from "@/components/CherryDivider";
import { salvarClienteAtual } from "@/lib/store";
import { registrarCliente } from "@/lib/api";
import type { Cliente } from "@/lib/types";

export default function CadastroPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    nome: "",
    cpf: "",
    telefone: "",
    rua: "",
    numero: "",
    bairro: "",
    cidade: "Arapongas",
    cep: "",
    complemento: "",
  });
  const [erro, setErro] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  const [salvando, setSalvando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome || !form.cpf || !form.telefone || !form.rua || !form.numero || !form.cep) {
      setErro("Preencha todos os campos obrigatórios para continuar.");
      return;
    }

    const cliente: Cliente = {
      id: crypto.randomUUID(),
      nome: form.nome,
      cpf: form.cpf,
      telefone: form.telefone,
      endereco: {
        rua: form.rua,
        numero: form.numero,
        bairro: form.bairro,
        cidade: form.cidade,
        cep: form.cep,
        complemento: form.complemento,
        // TODO: geocodificar automaticamente (Google Geocoding / Nominatim)
        // ao invés de deixar lat/lng em branco, para o cálculo de frete
        // funcionar de ponta a ponta.
      },
      criadoEm: new Date().toISOString(),
    };

    setErro("");
    setSalvando(true);
    salvarClienteAtual(cliente);
    try {
      await registrarCliente(cliente);
      router.push("/catalogo");
    } catch {
      setErro("Não foi possível salvar seu cadastro. Tente novamente.");
      setSalvando(false);
    }
  }

  return (
    <main className="min-h-screen px-6 md:px-12 py-10 max-w-xl mx-auto">
      <h1 className="font-display text-3xl text-cherryDark text-center">
        Bem-vinda(o) à Doceterapia
      </h1>
      <p className="text-center text-ink/70 mt-2 font-body">
        Antes de ver nosso cardápio, preciso de alguns dados pra confirmar
        seu pedido depois.
      </p>
      <CherryDivider />

      <form onSubmit={handleSubmit} className="grid gap-4 mt-6">
        <Campo label="Nome completo *" name="nome" value={form.nome} onChange={handleChange} />
        <Campo label="CPF *" name="cpf" value={form.cpf} onChange={handleChange} placeholder="000.000.000-00" />
        <Campo label="Telefone *" name="telefone" value={form.telefone} onChange={handleChange} placeholder="(43) 99999-9999" />

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <Campo label="Rua *" name="rua" value={form.rua} onChange={handleChange} />
          </div>
          <Campo label="Número *" name="numero" value={form.numero} onChange={handleChange} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Campo label="Bairro" name="bairro" value={form.bairro} onChange={handleChange} />
          <Campo label="CEP *" name="cep" value={form.cep} onChange={handleChange} />
        </div>

        <Campo label="Complemento" name="complemento" value={form.complemento} onChange={handleChange} />

        {erro && <p className="text-cherryDark text-sm font-body">{erro}</p>}

        <button
          type="submit"
          disabled={salvando}
          className="mt-4 bg-cherryDark text-white rounded-full py-3 font-body font-semibold hover:bg-cherryMid transition-colors disabled:opacity-50"
        >
          {salvando ? "Salvando..." : "Continuar para o cardápio"}
        </button>
      </form>
    </main>
  );
}

function Campo({
  label,
  name,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-body text-ink/80">
      {label}
      <input
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="border border-cherryLight/60 rounded-xl px-4 py-2 bg-white/70 focus:outline-none focus:ring-2 focus:ring-cherryDark"
      />
    </label>
  );
}
