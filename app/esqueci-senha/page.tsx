"use client";

import { useState } from "react";
import Link from "next/link";
import CherryDivider from "@/components/CherryDivider";
import { pedirCodigoSenha, redefinirSenha } from "@/lib/api";
import { useSobre } from "@/lib/usar-sobre";
import { SENHA_MINIMA } from "@/lib/senha-regras";

/**
 * Recuperação de senha em dois passos na mesma tela: primeiro o e-mail (é pra
 * ele que o código vai), depois o código e a senha nova. No fim, manda de
 * volta para o login.
 */
export default function EsqueciSenhaPage() {
  const { linkWhatsApp } = useSobre();
  const [passo, setPasso] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function pedirCodigo(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      await pedirCodigoSenha(email);
      setPasso(2);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar o código.");
    } finally {
      setCarregando(false);
    }
  }

  async function trocarSenha(e: React.FormEvent) {
    e.preventDefault();
    if (senha !== confirmarSenha) {
      setErro("As senhas não são iguais. Confira os dois campos.");
      return;
    }
    if (senha.length < SENHA_MINIMA) {
      setErro(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`);
      return;
    }

    setErro("");
    setCarregando(true);
    try {
      await redefinirSenha({ email, codigo, senha, confirmarSenha });
      setPasso(3);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível redefinir a senha.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="min-h-screen px-4 sm:px-6 py-12 max-w-sm mx-auto flex flex-col justify-center">
      <h1 className="font-display text-2xl sm:text-3xl text-cherryDark text-center">
        <span className="font-bold">doce</span>
        <span className="text-cherryLight">terapia</span>
      </h1>

      {passo === 1 && (
        <>
          <p className="text-center text-ink/70 mt-2 font-body text-sm">
            Informe o e-mail do seu cadastro que enviamos um código pra ele.
          </p>
          <CherryDivider />
          <form onSubmit={pedirCodigo} className="grid gap-4">
            <label className="grid gap-1 text-sm font-body text-ink/80">
              E-mail
              <input
                name="username"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
                className="w-full border border-cherryLight/60 rounded-xl px-4 py-2.5 bg-white/70 focus:outline-none focus:ring-2 focus:ring-cherryDark"
              />
            </label>
            {erro && <p className="text-cherryDark text-sm font-body">{erro}</p>}
            <button
              type="submit"
              disabled={carregando}
              className="bg-cherryDark text-white rounded-full py-3 font-body font-semibold hover:bg-cherryMid transition-colors disabled:opacity-50"
            >
              {carregando ? "Enviando..." : "Enviar código"}
            </button>
          </form>
        </>
      )}

      {passo === 2 && (
        <>
          <p className="text-center text-ink/70 mt-2 font-body text-sm">
            Se <strong className="text-ink/80">{email}</strong> tiver uma conta aqui,
            o código já está a caminho. Ele vale por 15 minutos — dá uma olhada no
            spam se não aparecer.
          </p>
          <CherryDivider />
          <form onSubmit={trocarSenha} className="grid gap-4">
            <label className="grid gap-1 text-sm font-body text-ink/80">
              Código de 6 dígitos
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="w-full border border-cherryLight/60 rounded-xl px-4 py-2.5 bg-white/70 text-center text-xl tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-cherryDark"
              />
            </label>
            <label className="grid gap-1 text-sm font-body text-ink/80">
              Nova senha
              <input
                type="password"
                autoComplete="new-password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full border border-cherryLight/60 rounded-xl px-4 py-2.5 bg-white/70 focus:outline-none focus:ring-2 focus:ring-cherryDark"
              />
              <span className="text-xs text-ink/50">
                Pelo menos {SENHA_MINIMA} caracteres.
              </span>
            </label>
            <label className="grid gap-1 text-sm font-body text-ink/80">
              Confirmar nova senha
              <input
                type="password"
                autoComplete="new-password"
                required
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                className={`w-full border rounded-xl px-4 py-2.5 bg-white/70 focus:outline-none focus:ring-2 focus:ring-cherryDark ${
                  confirmarSenha && senha !== confirmarSenha
                    ? "border-cherryDark"
                    : "border-cherryLight/60"
                }`}
              />
              {confirmarSenha && senha !== confirmarSenha && (
                <span className="text-xs text-cherryDark">As senhas não são iguais.</span>
              )}
            </label>
            {erro && <p className="text-cherryDark text-sm font-body">{erro}</p>}
            <button
              type="submit"
              disabled={carregando}
              className="bg-cherryDark text-white rounded-full py-3 font-body font-semibold hover:bg-cherryMid transition-colors disabled:opacity-50"
            >
              {carregando ? "Salvando..." : "Salvar nova senha"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPasso(1);
                setCodigo("");
                setErro("");
              }}
              className="text-sm font-body text-cherryMid underline py-2"
            >
              Não recebi o código
            </button>
          </form>
        </>
      )}

      {passo === 3 && (
        <>
          <div className="text-center text-5xl mt-4">🍒</div>
          <p className="text-center font-display text-xl text-cherryDark mt-3">
            Senha alterada!
          </p>
          <p className="text-center text-ink/70 mt-2 font-body text-sm">
            Agora você já pode entrar com a sua nova senha.
          </p>
          <CherryDivider />
          <Link
            href="/entrar"
            className="text-center bg-cherryDark text-white rounded-full py-3 font-body font-semibold hover:bg-cherryMid transition-colors"
          >
            Ir para o login
          </Link>
        </>
      )}

      {passo !== 3 && (
        <>
          <CherryDivider />
          <div className="text-center">
            <Link
              href="/entrar"
              className="text-sm font-body text-ink/60 underline inline-block py-3 px-1"
            >
              Voltar para o login
            </Link>
          </div>
          <a
            href={linkWhatsApp(
              "Oi, Camily! Não estou conseguindo recuperar a senha da minha conta no site da Doceterapia. Consegue me ajudar?"
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="text-center text-xs font-body text-ink/50 underline py-2"
          >
            Continua com problema? Fale com a Camily
          </a>
        </>
      )}
    </main>
  );
}
