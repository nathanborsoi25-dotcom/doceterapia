"use client";

import { useEffect, useRef, useState } from "react";
import {
  buscarEnderecoPorCep,
  geocodificarEndereco,
  getClienteLogado,
  salvarMeusDados,
} from "@/lib/api";
import { formatarCep, formatarTelefone } from "@/lib/formato";
import { apenasDigitos } from "@/lib/validacoes";

/**
 * "Meus dados": o cliente arruma o próprio cadastro sem precisar chamar a
 * Camily. O e-mail pode ser trocado aqui, e trocá-lo troca o login — por isso
 * o aviso embaixo do campo.
 */
export default function MeusDados() {
  const [form, setForm] = useState({
    nome: "",
    email: "",
    telefone: "",
    rua: "",
    numero: "",
    bairro: "",
    cidade: "",
    cep: "",
    complemento: "",
  });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [salvo, setSalvo] = useState(false);
  const [avisoCep, setAvisoCep] = useState("");
  const numeroRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getClienteLogado()
      .then((c) => {
        if (!c) return;
        setForm({
          nome: c.nome,
          email: c.email,
          telefone: formatarTelefone(c.telefone),
          rua: c.endereco.rua,
          numero: c.endereco.numero,
          bairro: c.endereco.bairro,
          cidade: c.endereco.cidade,
          cep: formatarCep(c.endereco.cep),
          complemento: c.endereco.complemento ?? "",
        });
      })
      .finally(() => setCarregando(false));
  }, []);

  function mudar(campo: string, valor: string) {
    const mascaras: Record<string, (v: string) => string> = {
      telefone: formatarTelefone,
      cep: formatarCep,
    };
    const novo = mascaras[campo] ? mascaras[campo](valor) : valor;
    setForm((f) => ({ ...f, [campo]: novo }));
    setSalvo(false);

    if (campo === "cep" && apenasDigitos(novo).length === 8) {
      preencherPeloCep(novo);
    }
  }

  async function preencherPeloCep(cep: string) {
    setAvisoCep("");
    const e = await buscarEnderecoPorCep(cep);
    if (!e) {
      setAvisoCep("Não encontramos esse CEP. Dá pra preencher à mão.");
      return;
    }
    setForm((f) => ({
      ...f,
      rua: e.rua || f.rua,
      bairro: e.bairro || f.bairro,
      cidade: e.cidade || f.cidade,
    }));
    numeroRef.current?.focus();
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvando(true);
    try {
      // Refaz as coordenadas: se a pessoa mudou de casa, o frete do próximo
      // pedido precisa sair pela distância nova.
      const coords = await geocodificarEndereco({
        rua: form.rua,
        numero: form.numero,
        bairro: form.bairro,
        cidade: form.cidade,
        cep: form.cep,
      });

      await salvarMeusDados({
        nome: form.nome,
        email: form.email,
        telefone: form.telefone,
        endereco: {
          rua: form.rua,
          numero: form.numero,
          bairro: form.bairro,
          cidade: form.cidade,
          cep: form.cep,
          complemento: form.complemento,
          lat: coords.lat ?? undefined,
          lng: coords.lng ?? undefined,
        },
      });
      setSalvo(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return <p className="font-body text-ink/60 text-center py-8">Carregando seus dados...</p>;
  }

  return (
    <form onSubmit={salvar} className="grid gap-4">
      <Campo label="Nome completo" valor={form.nome} onChange={(v) => mudar("nome", v)} autoComplete="name" />

      <Campo
        label="E-mail"
        valor={form.email}
        onChange={(v) => mudar("email", v)}
        tipo="email"
        autoComplete="email"
        dica="É com ele que você entra no site. Se trocar aqui, o login passa a ser o novo."
      />
      <Campo
        label="Telefone"
        valor={form.telefone}
        onChange={(v) => mudar("telefone", v)}
        autoComplete="tel"
        inputMode="numeric"
      />
      <Campo
        label="CEP"
        valor={form.cep}
        onChange={(v) => mudar("cep", v)}
        autoComplete="postal-code"
        inputMode="numeric"
        erro={avisoCep || undefined}
        dica="Digite o CEP que preenchemos o endereço pra você."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2 min-w-0">
          <Campo label="Rua" valor={form.rua} onChange={(v) => mudar("rua", v)} autoComplete="address-line1" />
        </div>
        <div className="min-w-0">
          <Campo
            label="Número"
            valor={form.numero}
            onChange={(v) => mudar("numero", v)}
            inputMode="numeric"
            inputRef={numeroRef}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="min-w-0">
          <Campo label="Bairro" valor={form.bairro} onChange={(v) => mudar("bairro", v)} />
        </div>
        <div className="min-w-0">
          <Campo label="Cidade" valor={form.cidade} onChange={(v) => mudar("cidade", v)} />
        </div>
      </div>

      <Campo
        label="Complemento"
        valor={form.complemento}
        onChange={(v) => mudar("complemento", v)}
        placeholder="Apto, bloco, casa..."
      />

      {erro && <p className="text-sm text-cherryDark font-body">{erro}</p>}
      {salvo && (
        <p className="text-sm font-body text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
          Prontinho, seus dados foram salvos. 🍒
        </p>
      )}

      <button
        disabled={salvando}
        className="bg-cherryDark text-white rounded-full py-3 font-body font-semibold hover:bg-cherryMid transition-colors disabled:opacity-50"
      >
        {salvando ? "Salvando..." : "Salvar alterações"}
      </button>
    </form>
  );
}

function Campo({
  label,
  valor,
  onChange,
  placeholder,
  tipo = "text",
  autoComplete,
  inputMode,
  dica,
  erro,
  inputRef,
}: {
  label: string;
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  tipo?: string;
  autoComplete?: string;
  inputMode?: "numeric" | "text";
  dica?: string;
  erro?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <label className="grid gap-1 text-sm font-body text-ink/80">
      {label}
      <input
        ref={inputRef}
        type={tipo}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        className={`w-full border rounded-xl px-4 py-2.5 bg-white/70 focus:outline-none focus:ring-2 focus:ring-cherryDark ${
          erro ? "border-cherryDark" : "border-cherryLight/60"
        }`}
      />
      {erro ? (
        <span className="text-xs text-cherryDark">{erro}</span>
      ) : dica ? (
        <span className="text-xs text-ink/50">{dica}</span>
      ) : null}
    </label>
  );
}
