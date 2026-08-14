"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import VoltarAoPainel from "@/components/VoltarAoPainel";
import {
  FUNCIONAMENTO_PADRAO,
  horarioEscrito,
  limparFuncionamento,
  lojaAberta,
} from "@/lib/funcionamento";
import {
  avisoDeEntregaHoje,
  ENTREGA_PADRAO,
  horaFalada,
  limparHorarioDeEntrega,
} from "@/lib/entrega-horario";
import { pontosDaLoja, type PontoRetirada } from "@/lib/retirada";

/**
 * Onde a cliente pode buscar o pedido — a Camily edita aqui.
 *
 * Cada endereço tem uma ou mais faixas de horário (uma por linha), porque um
 * lugar pode abrir de manhã e o outro só à noite e no fim de semana. É isso
 * que a cliente lê na hora de escolher a retirada.
 */
export default function AdminRetiradaPage() {
  const router = useRouter();
  const [pontos, setPontos] = useState<PontoRetirada[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState("");

  /** Horário em que a loja aceita pedido — vale pros dois endereços. */
  const [funcionamento, setFuncionamento] = useState(FUNCIONAMENTO_PADRAO);
  const [salvandoHorario, setSalvandoHorario] = useState(false);
  const [horarioSalvo, setHorarioSalvo] = useState(false);

  /**
   * Horário em que a ENTREGA sai — outra coisa. A loja aceita pedido até as
   * 22h, mas a Camily só roda a cidade até as 16h30 nos dias de semana.
   */
  const [entrega, setEntrega] = useState(ENTREGA_PADRAO);
  const [salvandoEntrega, setSalvandoEntrega] = useState(false);
  const [entregaSalva, setEntregaSalva] = useState(false);

  useEffect(() => {
    fetch("/api/config-loja", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => {
        setPontos(pontosDaLoja(c?.pontosRetirada));
        setFuncionamento(limparFuncionamento(c?.funcionamento));
        setEntrega(limparHorarioDeEntrega(c?.entrega));
      })
      .catch(() => setErro("Não consegui carregar os endereços. Tenta recarregar a página?"))
      .finally(() => setCarregando(false));
  }, []);

  function mudarEntrega(
    qual: "semana" | "fimDeSemana",
    campo: "abre" | "fecha",
    valor: string
  ) {
    setEntrega((e) => ({ ...e, [qual]: { ...e[qual], [campo]: valor } }));
    setEntregaSalva(false);
  }

  async function salvarEntrega() {
    setSalvandoEntrega(true);
    setEntregaSalva(false);
    try {
      const r = await fetch("/api/config-loja", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entrega }),
      });
      if (!r.ok) throw new Error("recusado");
      router.refresh();
      setEntregaSalva(true);
      setTimeout(() => setEntregaSalva(false), 3000);
    } catch {
      setErro("Não consegui salvar o horário de entrega. Tenta de novo?");
    } finally {
      setSalvandoEntrega(false);
    }
  }

  function mudarHorario(mudanca: Partial<typeof FUNCIONAMENTO_PADRAO>) {
    setFuncionamento((f) => ({ ...f, ...mudanca }));
    setHorarioSalvo(false);
  }

  /** Salva só o horário: a rota preserva o resto da configuração. */
  async function salvarHorario() {
    setSalvandoHorario(true);
    setHorarioSalvo(false);
    try {
      await fetch("/api/config-loja", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ funcionamento }),
      });
      // Limpa o que o navegador guardou das telas do cliente.
      router.refresh();
      setHorarioSalvo(true);
      setTimeout(() => setHorarioSalvo(false), 3000);
    } finally {
      setSalvandoHorario(false);
    }
  }

  function mudarPonto(id: string, mudanca: Partial<PontoRetirada>) {
    setPontos((lista) => lista.map((p) => (p.id === id ? { ...p, ...mudanca } : p)));
    setSalvo(false);
  }

  function adicionar() {
    setPontos((lista) => [
      ...lista,
      { id: crypto.randomUUID(), endereco: "", horarios: [""] },
    ]);
    setSalvo(false);
  }

  function remover(id: string) {
    setPontos((lista) => lista.filter((p) => p.id !== id));
    setSalvo(false);
  }

  const semEndereco = pontos.some((p) => !p.endereco.trim());

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (pontos.length === 0) {
      setErro("Deixe pelo menos um endereço: é onde o cliente vai buscar.");
      return;
    }
    if (semEndereco) {
      setErro("Tem endereço em branco. Preencha ou remova o cartão.");
      return;
    }

    setErro("");
    setSalvando(true);
    try {
      const r = await fetch("/api/config-loja", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pontosRetirada: pontos.map((p) => ({
            ...p,
            endereco: p.endereco.trim(),
            horarios: p.horarios.map((h) => h.trim()).filter(Boolean),
          })),
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
        <p className="font-body text-ink/60 text-center py-10">Carregando os endereços...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 sm:px-6 md:px-12 py-8 md:py-10 max-w-2xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl sm:text-3xl text-cherryDark">
          Onde o cliente busca
        </h1>
        <VoltarAoPainel />
      </div>
      <p className="font-body text-sm text-ink/60 mt-1">
        Quando o cliente escolhe <strong>Retirada</strong>, ele vê estes
        endereços e escolhe um.{" "}
        <Link
          href="/checkout"
          target="_blank"
          className="text-cherryDark underline inline-flex items-center min-h-[44px] px-1"
        >
          Ver como está no site
        </Link>
      </p>
      <p className="font-body text-xs text-ink/50 mt-2">
        O dia e a hora continuam sendo combinados por você no WhatsApp — aqui é
        só o lugar e os horários em que você atende.
      </p>

      {/* ---------- Horário em que o site aceita pedido ---------- */}
      <h2 className="font-display text-xl text-cherryDark mt-8">
        Horário de funcionamento da loja
      </h2>
      <p className="font-body text-sm text-ink/60 mt-1">
        Fora deste horário o site <strong>não deixa fechar pedido</strong>. O
        cliente continua vendo o cardápio e montando o carrinho — só o
        pagamento espera você abrir.
      </p>

      <div className="bg-white/70 border border-cherryLight/30 rounded-2xl p-4 mt-3 grid gap-3">
        <label className="flex items-start gap-2 font-body text-sm">
          <input
            type="checkbox"
            checked={funcionamento.ativo}
            onChange={(e) => mudarHorario({ ativo: e.target.checked })}
            className="w-5 h-5 accent-cherryDark mt-0.5"
          />
          <span>
            Fechar a loja fora do horário
            <span className="block text-xs text-ink/55">
              Desmarcando, o site aceita pedido a qualquer hora do dia.
            </span>
          </span>
        </label>

        {funcionamento.ativo && (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1 text-sm font-body text-ink/80">
                Abre às
                <select
                  value={funcionamento.abreAs}
                  onChange={(e) => mudarHorario({ abreAs: Number(e.target.value) })}
                  className="border border-cherryLight/50 rounded-xl p-2.5 bg-white/70 font-body"
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {h}h
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-body text-ink/80">
                Fecha às
                <select
                  value={funcionamento.fechaAs}
                  onChange={(e) => mudarHorario({ fechaAs: Number(e.target.value) })}
                  className="border border-cherryLight/50 rounded-xl p-2.5 bg-white/70 font-body"
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {h}h
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* O que a cliente vai ler, com o valor de agora — evita ela
                salvar um horário e só descobrir o texto depois, no site. */}
            <p className="font-body text-xs text-ink/60 bg-blush/40 border border-cherryLight/30 rounded-xl px-3 py-2.5">
              O cliente vê: <strong>{horarioEscrito(funcionamento)}</strong>.
              Agora a loja está{" "}
              <strong>{lojaAberta(funcionamento) ? "aberta" : "fechada"}</strong>.
              <span className="block mt-1">
                Fechando às {funcionamento.fechaAs}h, o último pedido entra às{" "}
                {funcionamento.fechaAs}h em ponto — {funcionamento.fechaAs}h01 já
                é recusado.
              </span>
            </p>
          </>
        )}

        <button
          type="button"
          onClick={salvarHorario}
          disabled={salvandoHorario}
          className={`rounded-full py-3 font-body font-semibold text-white disabled:opacity-50 ${
            horarioSalvo ? "bg-green-600" : "bg-cherryDark"
          }`}
        >
          {salvandoHorario ? "Salvando..." : horarioSalvo ? "Salvo ✓" : "Salvar horário"}
        </button>
      </div>

      {/* ---------- Horário da ENTREGA ---------- */}
      <h2 className="font-display text-xl text-cherryDark mt-8">
        Horário de entrega
      </h2>
      <p className="font-body text-sm text-ink/60 mt-1">
        Até que horas você consegue entregar. É diferente do horário acima: a
        loja pode continuar recebendo pedido depois que as entregas do dia
        acabaram.
      </p>

      <div className="grid gap-4 mt-4 bg-white/70 border border-cherryLight/30 rounded-2xl p-4">
        {(
          [
            { chave: "semana", titulo: "Segunda a sexta" },
            { chave: "fimDeSemana", titulo: "Sábado e domingo" },
          ] as const
        ).map(({ chave, titulo }) => (
          <div key={chave}>
            <p className="font-body text-sm font-semibold text-ink/80">{titulo}</p>
            <div className="flex flex-wrap items-end gap-3 mt-1.5">
              <label className="grid gap-1 text-xs font-body text-ink/60">
                Começa
                <input
                  type="time"
                  value={entrega[chave].abre}
                  onChange={(e) => mudarEntrega(chave, "abre", e.target.value)}
                  className="border border-cherryLight/50 rounded-xl px-3 py-2 bg-white/70 focus:outline-none focus:ring-2 focus:ring-cherryDark"
                />
              </label>
              <label className="grid gap-1 text-xs font-body text-ink/60">
                Última entrega
                <input
                  type="time"
                  value={entrega[chave].fecha}
                  onChange={(e) => mudarEntrega(chave, "fecha", e.target.value)}
                  className="border border-cherryLight/50 rounded-xl px-3 py-2 bg-white/70 focus:outline-none focus:ring-2 focus:ring-cherryDark"
                />
              </label>
            </div>
          </div>
        ))}

        {/* O que a cliente vai ler, com o valor de agora. */}
        <p className="font-body text-xs text-ink/60 bg-blush/40 border border-cherryLight/30 rounded-xl px-3 py-2.5">
          O cliente vê: entregas de{" "}
          <strong>
            {horaFalada(entrega.semana.abre)} às {horaFalada(entrega.semana.fecha)}
          </strong>{" "}
          de segunda a sexta, e de{" "}
          <strong>
            {horaFalada(entrega.fimDeSemana.abre)} às{" "}
            {horaFalada(entrega.fimDeSemana.fecha)}
          </strong>{" "}
          no fim de semana.
          <span className="block mt-1">
            {avisoDeEntregaHoje(entrega)
              ? "Agora as entregas de hoje já encerraram — quem comprar doce de pronta entrega vê o aviso de que recebe amanhã."
              : "Agora ainda dá tempo de sair entrega hoje."}
          </span>
        </p>

        <button
          type="button"
          onClick={salvarEntrega}
          disabled={salvandoEntrega}
          className={`rounded-full py-3 font-body font-semibold text-white disabled:opacity-50 ${
            entregaSalva ? "bg-green-600" : "bg-cherryDark"
          }`}
        >
          {salvandoEntrega
            ? "Salvando..."
            : entregaSalva
              ? "Salvo ✓"
              : "Salvar horário de entrega"}
        </button>
      </div>

      <h2 className="font-display text-xl text-cherryDark mt-8">
        Endereços de retirada
      </h2>

      <form onSubmit={salvar} className="grid gap-4 mt-6">
        {pontos.map((ponto, i) => (
          <div
            key={ponto.id}
            className="bg-white/70 border border-cherryLight/30 rounded-2xl p-4 grid gap-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-display text-base text-cherryDark">
                Endereço {i + 1}
              </span>
              <button
                type="button"
                onClick={() => remover(ponto.id)}
                className="font-body text-xs text-ink/50 underline inline-flex items-center min-h-[44px] px-1 hover:text-cherryDark"
              >
                Remover
              </button>
            </div>

            <label className="grid gap-1 text-sm font-body text-ink/80">
              Rua e número
              <input
                value={ponto.endereco}
                onChange={(e) => mudarPonto(ponto.id, { endereco: e.target.value })}
                placeholder="Ex: Rua Ajaja, 41"
                className="w-full border border-cherryLight/60 rounded-xl px-4 py-2.5 bg-white/70 focus:outline-none focus:ring-2 focus:ring-cherryDark"
              />
            </label>

            <label className="grid gap-1 text-sm font-body text-ink/80">
              Horários
              <textarea
                value={ponto.horarios.join("\n")}
                onChange={(e) =>
                  mudarPonto(ponto.id, { horarios: e.target.value.split("\n") })
                }
                rows={3}
                placeholder={"Segunda a sexta, das 9h às 16h30\nSábado, das 9h às 12h"}
                className="w-full border border-cherryLight/60 rounded-xl px-4 py-2.5 bg-white/70 focus:outline-none focus:ring-2 focus:ring-cherryDark resize-y"
              />
              <span className="text-xs text-ink/50">
                Um horário por linha. Escreva do jeito que o cliente entende.
              </span>
            </label>
          </div>
        ))}

        <button
          type="button"
          onClick={adicionar}
          className="border border-cherryDark text-cherryDark rounded-full py-3 font-body font-semibold hover:bg-blush transition-colors"
        >
          + Adicionar outro endereço
        </button>

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

        <p className="text-xs text-ink/45 font-body text-center">
          Mudar um endereço aqui não mexe nos pedidos que já foram feitos: cada
          pedido guarda o endereço que o cliente leu na hora de comprar.
        </p>
      </form>
    </main>
  );
}
