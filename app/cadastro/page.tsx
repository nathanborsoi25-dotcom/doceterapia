"use client";

import { useState } from "react";
import Link from "next/link";
import CherryDivider from "@/components/CherryDivider";
import { cadastrarCliente, geocodificarEndereco } from "@/lib/api";
import { formatarCep, formatarCpf, formatarTelefone } from "@/lib/formato";
import { cpfValido, emailValido, telefoneValido } from "@/lib/validacoes";
import { SENHA_MINIMA } from "@/lib/senha-regras";

export default function CadastroPage() {
  const [form, setForm] = useState({
    nome: "",
    cpf: "",
    email: "",
    telefone: "",
    rua: "",
    numero: "",
    bairro: "",
    cidade: "Arapongas",
    cep: "",
    complemento: "",
    senha: "",
    confirmarSenha: "",
  });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    const mascaras: Record<string, (v: string) => string> = {
      cpf: formatarCpf,
      telefone: formatarTelefone,
      cep: formatarCep,
    };
    setForm((f) => ({ ...f, [name]: mascaras[name] ? mascaras[name](value) : value }));
  }

  /** Devolve a primeira mensagem de erro do formulário, ou null se está tudo certo. */
  function validar(): string | null {
    if (!form.nome.trim()) return "Informe seu nome completo.";
    if (!cpfValido(form.cpf)) return "CPF inválido. Confira os números.";
    if (!emailValido(form.email))
      return "Informe um e-mail válido — é por ele que você recupera a senha.";
    if (!telefoneValido(form.telefone)) return "Informe um telefone com DDD.";
    if (!form.rua.trim() || !form.numero.trim() || !form.cep.trim())
      return "Preencha o endereço (rua, número e CEP).";
    if (form.senha.length < SENHA_MINIMA)
      return `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`;
    if (form.senha !== form.confirmarSenha)
      return "As senhas não são iguais. Confira os dois campos.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const problema = validar();
    if (problema) {
      setErro(problema);
      return;
    }

    setErro("");
    setSalvando(true);

    // Geocodifica o endereço (vira lat/lng) pra o frete sair sozinho no checkout.
    const coords = await geocodificarEndereco({
      rua: form.rua,
      numero: form.numero,
      bairro: form.bairro,
      cidade: form.cidade,
      cep: form.cep,
    });

    try {
      await cadastrarCliente({
        nome: form.nome,
        cpf: form.cpf,
        email: form.email,
        telefone: form.telefone,
        senha: form.senha,
        confirmarSenha: form.confirmarSenha,
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
      // Navegação completa para o navegador oferecer salvar a senha.
      window.location.assign("/catalogo");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível cadastrar.");
      setSalvando(false);
    }
  }

  const senhasDiferem =
    form.confirmarSenha.length > 0 && form.senha !== form.confirmarSenha;

  return (
    <main className="min-h-screen px-4 sm:px-6 md:px-12 py-8 md:py-10 max-w-xl mx-auto">
      <h1 className="font-display text-2xl sm:text-3xl text-cherryDark text-center">
        Bem-vinda(o) à Doceterapia
      </h1>
      <p className="text-center text-ink/70 mt-2 font-body">
        Crie sua conta para fazer pedidos e acompanhar tudo por aqui.
      </p>
      <CherryDivider />

      <form onSubmit={handleSubmit} method="post" action="#" className="grid gap-4">
        <Campo label="Nome completo *" name="nome" value={form.nome} onChange={handleChange} autoComplete="name" />
        <Campo
          label="CPF *"
          name="cpf"
          value={form.cpf}
          onChange={handleChange}
          placeholder="000.000.000-00"
          autoComplete="username"
          inputMode="numeric"
          dica="Você vai usar o CPF para entrar no site."
        />
        <Campo
          label="E-mail *"
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          placeholder="voce@email.com"
          autoComplete="email"
          dica="É para cá que enviamos o código se você esquecer a senha."
        />
        <Campo label="Telefone *" name="telefone" value={form.telefone} onChange={handleChange} placeholder="(43) 99999-9999" autoComplete="tel" inputMode="numeric" />

        {/* Em telas estreitas cada campo ocupa a linha inteira; a partir do
            celular deitado eles voltam a dividir a linha. */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2 min-w-0">
            <Campo label="Rua *" name="rua" value={form.rua} onChange={handleChange} autoComplete="address-line1" />
          </div>
          <div className="min-w-0">
            <Campo label="Número *" name="numero" value={form.numero} onChange={handleChange} inputMode="numeric" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="min-w-0">
            <Campo label="Bairro" name="bairro" value={form.bairro} onChange={handleChange} />
          </div>
          <div className="min-w-0">
            <Campo label="CEP *" name="cep" value={form.cep} onChange={handleChange} placeholder="86700-000" autoComplete="postal-code" inputMode="numeric" />
          </div>
        </div>

        <Campo label="Complemento" name="complemento" value={form.complemento} onChange={handleChange} />

        <CherryDivider />

        <Campo
          label="Criar senha *"
          name="senha"
          type="password"
          value={form.senha}
          onChange={handleChange}
          autoComplete="new-password"
          dica={`Pelo menos ${SENHA_MINIMA} caracteres.`}
        />
        <Campo
          label="Confirmar senha *"
          name="confirmarSenha"
          type="password"
          value={form.confirmarSenha}
          onChange={handleChange}
          autoComplete="new-password"
          erro={senhasDiferem ? "As senhas não são iguais." : undefined}
        />

        {erro && <p className="text-cherryDark text-sm font-body">{erro}</p>}

        <button
          type="submit"
          disabled={salvando}
          className="mt-2 bg-cherryDark text-white rounded-full py-3 font-body font-semibold hover:bg-cherryMid transition-colors disabled:opacity-50"
        >
          {salvando ? "Criando sua conta..." : "Criar conta e ver o cardápio"}
        </button>
      </form>

      <p className="text-center font-body text-sm text-ink/70 mt-6">
        Já tem cadastro?{" "}
        <Link href="/entrar" className="text-cherryDark underline inline-block py-3 px-1">
          Entrar
        </Link>
      </p>
    </main>
  );
}

function Campo({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
  inputMode,
  dica,
  erro,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
  inputMode?: "numeric" | "text";
  dica?: string;
  erro?: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-body text-ink/80">
      {label}
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
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
