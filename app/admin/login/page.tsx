"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginAdmin } from "@/lib/api";

/**
 * Login do admin. A senha é conferida no SERVIDOR (rota /api/admin/login),
 * a partir da variável de ambiente ADMIN_PASSWORD — ela nunca aparece no
 * código da página. Ao acertar, o servidor grava um cookie de sessão seguro.
 */
export default function AdminLoginPage() {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [entrando, setEntrando] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEntrando(true);
    try {
      const ok = await loginAdmin(senha);
      if (ok) {
        router.push("/admin");
        router.refresh();
      } else {
        setErro("Senha incorreta.");
        setEntrando(false);
      }
    } catch {
      setErro("Não foi possível entrar. Tente novamente.");
      setEntrando(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="grid gap-4 max-w-sm w-full">
        <h1 className="font-display text-2xl text-cherryDark text-center">
          Área da Camily
        </h1>
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Senha de acesso"
          className="border border-cherryLight/60 rounded-xl px-4 py-2 bg-white/70"
        />
        {erro && <p className="text-cherryDark text-sm">{erro}</p>}
        <button
          disabled={entrando}
          className="bg-cherryDark text-white rounded-full py-3 font-semibold disabled:opacity-50"
        >
          {entrando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}
