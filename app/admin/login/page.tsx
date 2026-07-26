"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Login simples só para tirar o protótipo do papel. NÃO é seguro para
 * produção — antes de lançar de verdade, troque por autenticação de
 * verdade (ex: NextAuth com email/senha, ou Clerk), pois este PIN fica
 * visível no código-fonte do site. Ver README > "Próximos passos: login
 * seguro do admin".
 */
const PIN_TEMPORARIO = "doceterapia2026";

export default function AdminLoginPage() {
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pin === PIN_TEMPORARIO) {
      window.localStorage.setItem("dt_admin_ok", "1");
      router.push("/admin");
    } else {
      setErro("PIN incorreto.");
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
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="PIN de acesso"
          className="border border-cherryLight/60 rounded-xl px-4 py-2 bg-white/70"
        />
        {erro && <p className="text-cherryDark text-sm">{erro}</p>}
        <button className="bg-cherryDark text-white rounded-full py-3 font-semibold">
          Entrar
        </button>
      </form>
    </main>
  );
}
