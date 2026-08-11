"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import EscolherFoto from "@/components/EscolherFoto";
import IconeWhatsApp from "@/components/IconeWhatsApp";
import VoltarAoPainel from "@/components/VoltarAoPainel";
import { SOBRE_PADRAO } from "@/lib/config-loja";
import { linkWhatsAppNumero } from "@/lib/contato";
import { formatarTelefone } from "@/lib/formato";
import { telefoneValido } from "@/lib/validacoes";

/**
 * "Sobre mim": a Camily mexe no que aparece no rodapé de todas as telas do
 * cliente — a foto dela, o recadinho e o telefone.
 *
 * Tem uma prévia do rodapé em cima do formulário porque é o único jeito de ela
 * saber como vai ficar sem ter que salvar, sair do painel e ir olhar o site.
 */
export default function AdminSobrePage() {
  const router = useRouter();
  const [foto, setFoto] = useState("");
  const [textoSobre, setTextoSobre] = useState("");
  const [telefone, setTelefone] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    fetch("/api/config-loja", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => {
        if (!c) return;
        setFoto(c.sobreFoto ?? "");
        setTextoSobre(c.sobreTexto ?? "");
        setTelefone(formatarTelefone(c.telefone ?? ""));
      })
      .catch(() => setErro("Não consegui carregar seus dados. Tenta recarregar a página?"))
      .finally(() => setCarregando(false));
  }, []);

  // O que o cliente vê de fato: em branco, vale o padrão que já está no site.
  const textoNaTela = textoSobre.trim() || SOBRE_PADRAO.texto;
  const telefoneNaTela = telefone.trim() || SOBRE_PADRAO.telefone;
  const telefoneRuim = telefone.trim() !== "" && !telefoneValido(telefone);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (telefoneRuim) {
      setErro("Confira o telefone: precisa ter DDD e o número completo.");
      return;
    }

    setErro("");
    setSalvando(true);
    try {
      // Só os campos desta tela: o resto da configuração (pontos, banner)
      // continua como está.
      const r = await fetch("/api/config-loja", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sobreFoto: foto,
          sobreTexto: textoSobre.trim(),
          telefone: telefone.trim(),
        }),
      });
      if (!r.ok) throw new Error();
      // Limpa o que o navegador guardou das telas do cliente.
      router.refresh();
      setSalvo(true);
      setTimeout(() => setSalvo(false), 3000);
    } catch {
      setErro("Não consegui salvar agora. Tenta de novo?");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <main className="min-h-screen px-4 sm:px-6 md:px-12 py-8 md:py-10 max-w-2xl mx-auto">
        <p className="font-body text-ink/60 text-center py-10">Carregando seus dados...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 sm:px-6 md:px-12 py-8 md:py-10 max-w-2xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl sm:text-3xl text-cherryDark">Sobre mim</h1>
        <VoltarAoPainel />
      </div>
      <p className="font-body text-sm text-ink/60 mt-1">
        É o que aparece no finalzinho de todas as telas do site, pro cliente
        saber quem faz os doces.
      </p>

      {/* ---------- Prévia ---------- */}
      <div className="bg-blush/60 border border-cherryLight/40 rounded-2xl p-6 mt-6 text-center">
        <p className="font-body text-[11px] uppercase tracking-wide text-ink/45">
          Como o cliente vai ver
        </p>
        <div className="w-24 h-24 rounded-full mx-auto bg-cherryLight/40 overflow-hidden flex items-center justify-center text-3xl mt-3">
          {foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={foto} alt="" className="w-full h-full object-cover" />
          ) : (
            "🍒"
          )}
        </div>
        <h2 className="font-display text-lg mt-3 text-cherryDark">Camily Vilasboa</h2>
        <p className="font-body text-sm text-ink/70 mt-2 whitespace-pre-line">
          {textoNaTela}
        </p>
        <span className="inline-flex items-center gap-2 mt-3 font-body text-sm text-cherryDark bg-white/70 border border-cherryLight/50 rounded-full px-5 py-2.5">
          <IconeWhatsApp className="w-5 h-5 text-[#25D366]" />
          {telefoneNaTela}
        </span>
        <p className="font-body text-xs text-ink/45 mt-2">
          Tocando no telefone, o cliente já cai na sua conversa do WhatsApp.
        </p>
      </div>

      {/* ---------- Formulário ---------- */}
      <form onSubmit={salvar} className="grid gap-5 mt-8">
        <div className="grid gap-2">
          <EscolherFoto
            valor={foto}
            onChange={setFoto}
            label="Sua foto"
            vazio="🍒"
          />
          <span className="text-xs text-ink/50 -mt-1">
            Uma foto sua de rosto funciona melhor: ela aparece redondinha e pequena.
          </span>
        </div>

        <label className="grid gap-1 text-sm font-body text-ink/80">
          Seu recadinho
          <textarea
            value={textoSobre}
            onChange={(e) => {
              setTextoSobre(e.target.value.slice(0, 600));
              setSalvo(false);
            }}
            rows={5}
            placeholder={SOBRE_PADRAO.texto}
            className="w-full border border-cherryLight/60 rounded-xl px-4 py-2.5 bg-white/70 focus:outline-none focus:ring-2 focus:ring-cherryDark resize-y"
          />
          <span className="text-xs text-ink/50">
            {textoSobre.trim()
              ? `${textoSobre.length} de 600 caracteres.`
              : "Deixando em branco, fica o texto que já está no site hoje."}
          </span>
        </label>

        <label className="grid gap-1 text-sm font-body text-ink/80">
          Telefone do WhatsApp
          <input
            value={telefone}
            onChange={(e) => {
              setTelefone(formatarTelefone(e.target.value));
              setSalvo(false);
            }}
            inputMode="numeric"
            placeholder={SOBRE_PADRAO.telefone}
            className={`w-full border rounded-xl px-4 py-2.5 bg-white/70 focus:outline-none focus:ring-2 focus:ring-cherryDark ${
              telefoneRuim ? "border-cherryDark" : "border-cherryLight/60"
            }`}
          />
          {telefoneRuim ? (
            <span className="text-xs text-cherryDark">
              Falta alguma coisa: precisa do DDD e do número completo.
            </span>
          ) : (
            <span className="text-xs text-ink/50">
              É pra este número que vão os clientes que tocarem no rodapé.{" "}
              <a
                href={linkWhatsAppNumero(
                  telefoneNaTela,
                  "Oi! Testando o link do WhatsApp do site."
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cherryDark underline inline-flex items-center min-h-[44px] px-1"
              >
                Testar o link
              </a>
            </span>
          )}
        </label>

        {erro && <p className="text-sm text-cherryDark font-body">{erro}</p>}
        {salvo && (
          <p className="text-sm font-body text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
            Prontinho, já está no site. 🍒
          </p>
        )}

        <button
          disabled={salvando}
          className="bg-cherryDark text-white rounded-full py-3 font-body font-semibold hover:bg-cherryMid transition-colors disabled:opacity-50"
        >
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </main>
  );
}
