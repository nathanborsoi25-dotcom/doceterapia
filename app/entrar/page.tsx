"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CherryDivider from "@/components/CherryDivider";
import { entrarCliente } from "@/lib/api";
import { formatarCpf } from "@/lib/formato";

export default function EntrarPage() {
  const router = useRouter();
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [entrando, setEntrando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEntrando(true);
    try {
      await entrarCliente(cpf, senha);
      // Navegação completa (e não router.push) para o navegador entender que
      // o login deu certo e oferecer salvar a senha no gerenciador.
      window.location.assign("/catalogo");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível entrar.");
      setEntrando(false);
    }
  }

  return (
    <main className="min-h-screen px-6 py-12 max-w-sm mx-auto flex flex-col justify-center">
      <h1 className="font-display text-3xl text-cherryDark text-center">
        <span className="font-bold">doce</span>
        <span className="text-cherryLight">terapia</span>
      </h1>
      <p className="text-center text-ink/70 mt-2 font-body text-sm">
        Entre para ver o cardápio e fazer seu pedido.
      </p>
      <CherryDivider />

      {/* action/method deixam o formulário "de verdade" para o navegador,
          o que faz o gerenciador de senhas oferecer salvar o login. */}
      <form onSubmit={handleSubmit} method="post" action="#" className="grid gap-4">
        <label className="grid gap-1 text-sm font-body text-ink/80">
          CPF
          <input
            name="username"
            autoComplete="username"
            inputMode="numeric"
            required
            value={cpf}
            onChange={(e) => setCpf(formatarCpf(e.target.value))}
            placeholder="000.000.000-00"
            className="border border-cherryLight/60 rounded-xl px-4 py-2.5 bg-white/70 focus:outline-none focus:ring-2 focus:ring-cherryDark"
          />
        </label>

        <label className="grid gap-1 text-sm font-body text-ink/80">
          Senha
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Sua senha"
            className="border border-cherryLight/60 rounded-xl px-4 py-2.5 bg-white/70 focus:outline-none focus:ring-2 focus:ring-cherryDark"
          />
        </label>

        {erro && <p className="text-cherryDark text-sm font-body">{erro}</p>}

        <button
          type="submit"
          disabled={entrando}
          className="mt-1 bg-cherryDark text-white rounded-full py-3 font-body font-semibold hover:bg-cherryMid transition-colors disabled:opacity-50"
        >
          {entrando ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <Link
        href="/esqueci-senha"
        className="text-center text-sm font-body text-cherryMid underline mt-4"
      >
        Esqueceu a senha?
      </Link>

      <CherryDivider />

      <p className="text-center font-body text-sm text-ink/70">
        Ainda não tem cadastro?
      </p>
      <Link
        href="/cadastro"
        className="mt-3 text-center border border-cherryDark text-cherryDark rounded-full py-3 font-body font-semibold hover:bg-blush transition-colors"
      >
        Fazer cadastro
      </Link>
    </main>
  );
}
