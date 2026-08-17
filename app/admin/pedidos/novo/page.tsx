"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AvisoSalvo from "@/components/AvisoSalvo";
import CampoNumero from "@/components/CampoNumero";
import VoltarAoPainel from "@/components/VoltarAoPainel";
import { useAvisoSalvo } from "@/lib/usar-aviso-salvo";
import { getListaClientes, getProdutos } from "@/lib/api";
import { formatarTelefone, reais } from "@/lib/formato";
import { precoAPagar } from "@/lib/promocao";
import type { ClienteDoPainel, Produto, StatusPedido } from "@/lib/types";

/**
 * Lançar à mão uma venda que não nasceu no site: balcão, WhatsApp, encontro
 * na rua.
 *
 * O formulário é deliberadamente frouxo — **só os doces são obrigatórios**.
 * Quem está do outro lado do balcão tem pressa, e exigir cadastro completo
 * faria a Camily desistir e anotar num papel, que é exatamente o que esta
 * tela veio substituir.
 */

/** Um doce escolhido, do jeito que a tela precisa manipular. */
type Escolhido = {
  /** Chave única da linha: o mesmo doce pode entrar com dois recheios. */
  chave: string;
  produtoId: string;
  saborId?: string;
  quantidade: number;
};

const SITUACOES: { valor: StatusPedido; label: string; dica: string }[] = [
  { valor: "pago", label: "Já recebi", dica: "Entra como pago e vai direto para a fila." },
  { valor: "em_preparo", label: "Em preparo", dica: "Já comecei a fazer; recebo depois." },
  { valor: "concluido", label: "Já entreguei", dica: "Venda fechada, doce entregue." },
];

export default function NovoPedidoPage() {
  const router = useRouter();
  const { aviso, avisarSalvo, avisarErro } = useAvisoSalvo();

  const [cardapio, setCardapio] = useState<Produto[]>([]);
  const [pessoas, setPessoas] = useState<ClienteDoPainel[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [escolhidos, setEscolhidos] = useState<Escolhido[]>([]);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [nomeContato, setNomeContato] = useState("");
  const [telefoneContato, setTelefoneContato] = useState("");
  const [tipoEntrega, setTipoEntrega] = useState<"entrega" | "retirada">("retirada");
  const [enderecoTexto, setEnderecoTexto] = useState("");
  const [valorFrete, setValorFrete] = useState(0);
  const [desconto, setDesconto] = useState(0);
  const [status, setStatus] = useState<StatusPedido>("pago");

  useEffect(() => {
    Promise.all([getProdutos(), getListaClientes().catch(() => [])])
      .then(([p, c]) => {
        setCardapio(p.filter((x) => x.ativo));
        setPessoas(c);
      })
      .catch(() => setCardapio([]))
      .finally(() => setCarregando(false));
  }, []);

  function adicionar(produtoId: string, saborId?: string) {
    setEscolhidos((prev) => {
      const chave = `${produtoId}:${saborId ?? ""}`;
      const jaTem = prev.find((e) => e.chave === chave);
      if (jaTem) {
        return prev.map((e) =>
          e.chave === chave ? { ...e, quantidade: e.quantidade + 1 } : e
        );
      }
      return [...prev, { chave, produtoId, saborId, quantidade: 1 }];
    });
  }

  function mudarQuantidade(chave: string, quantidade: number) {
    setEscolhidos((prev) =>
      quantidade <= 0
        ? prev.filter((e) => e.chave !== chave)
        : prev.map((e) => (e.chave === chave ? { ...e, quantidade } : e))
    );
  }

  /** O que cada linha custa — a mesma conta que o servidor vai refazer. */
  const linhas = useMemo(() => {
    return escolhidos.map((e) => {
      const produto = cardapio.find((p) => p.id === e.produtoId);
      const sabor = produto?.sabores?.find((s) => s.id === e.saborId);
      const unitario = produto ? precoAPagar(produto, sabor) : 0;
      return {
        ...e,
        nome: produto?.nome ?? "?",
        saborNome: sabor?.nome,
        unitario,
        total: unitario * e.quantidade,
      };
    });
  }, [escolhidos, cardapio]);

  const subtotal = linhas.reduce((soma, l) => soma + l.total, 0);
  const total = Math.max(0, subtotal - desconto) + (tipoEntrega === "entrega" ? valorFrete : 0);

  const encontrados = useMemo(() => {
    const termo = buscaCliente.trim().toLowerCase();
    if (!termo) return [];
    return pessoas
      .filter(
        (p) =>
          p.nome.toLowerCase().includes(termo) ||
          p.email.toLowerCase().includes(termo) ||
          (p.telefone ?? "").replace(/\D/g, "").includes(termo.replace(/\D/g, ""))
      )
      .slice(0, 5);
  }, [buscaCliente, pessoas]);

  const escolhida = pessoas.find((p) => p.id === clienteId) ?? null;

  async function salvar() {
    if (linhas.length === 0) {
      avisarErro("Escolha pelo menos um doce.");
      return;
    }

    setSalvando(true);
    try {
      const r = await fetch("/api/admin/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itens: escolhidos.map((e) => ({
            produtoId: e.produtoId,
            saborId: e.saborId,
            quantidade: e.quantidade,
          })),
          clienteId: clienteId || undefined,
          nomeContato: clienteId ? undefined : nomeContato,
          telefoneContato: clienteId ? undefined : telefoneContato,
          tipoEntrega,
          enderecoTexto,
          valorFrete,
          desconto,
          status,
        }),
      });

      const corpo = (await r.json()) as { error?: string };
      if (!r.ok) {
        avisarErro(corpo.error ?? "Não consegui salvar o pedido.");
        return;
      }

      avisarSalvo("Pedido lançado! 🍒");
      // Vai para a lista, onde ela acompanha como qualquer outro pedido.
      setTimeout(() => router.push("/admin/pedidos"), 700);
    } catch {
      avisarErro("Não consegui salvar. Confira sua internet e tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <main className="min-h-screen px-4 sm:px-6 md:px-12 py-8 md:py-10 max-w-3xl mx-auto">
      <AvisoSalvo aviso={aviso} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl sm:text-3xl text-cherryDark">Novo pedido</h1>
        <VoltarAoPainel />
      </div>
      <p className="text-sm font-body text-ink/60 mt-1">
        Para a venda que você fez pessoalmente ou pelo WhatsApp. Só os doces são
        obrigatórios — preencha o resto se souber.
      </p>

      {/* ---------- Os doces ---------- */}
      <section className="mt-6">
        <h2 className="font-display text-lg text-cherryDark">1. O que ela levou</h2>

        {carregando && <p className="font-body text-sm text-ink/60 mt-2">Carregando o cardápio...</p>}

        <div className="grid gap-1.5 mt-3">
          {cardapio.map((p) =>
            (p.sabores ?? []).length > 0 ? (
              (p.sabores ?? []).map((s) => (
                <button
                  key={`${p.id}:${s.id}`}
                  onClick={() => adicionar(p.id, s.id)}
                  className="flex items-center justify-between gap-3 min-h-[44px] rounded-xl border border-cherryLight/40 bg-white/70 px-4 py-2 text-left font-body text-sm hover:border-cherryDark transition-colors"
                >
                  <span className="min-w-0">
                    {p.nome} <span className="text-cherryMid">· {s.nome}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-ink/70">
                    {reais(precoAPagar(p, s))}
                  </span>
                </button>
              ))
            ) : (
              <button
                key={p.id}
                onClick={() => adicionar(p.id)}
                className="flex items-center justify-between gap-3 min-h-[44px] rounded-xl border border-cherryLight/40 bg-white/70 px-4 py-2 text-left font-body text-sm hover:border-cherryDark transition-colors"
              >
                <span className="min-w-0">{p.nome}</span>
                <span className="shrink-0 tabular-nums text-ink/70">{reais(precoAPagar(p))}</span>
              </button>
            )
          )}
        </div>

        {linhas.length > 0 && (
          <div className="mt-4 bg-blush/50 border border-cherryLight/50 rounded-2xl p-4 grid gap-2">
            {linhas.map((l) => (
              <div key={l.chave} className="flex items-center justify-between gap-3">
                <span className="font-body text-sm min-w-0">
                  {l.nome}
                  {l.saborNome && <span className="text-cherryMid"> · {l.saborNome}</span>}
                  <span className="block text-xs text-ink/55">{reais(l.unitario)} cada</span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => mudarQuantidade(l.chave, l.quantidade - 1)}
                    aria-label={`Tirar um ${l.nome}`}
                    className="w-11 h-11 rounded-full border border-cherryLight/60 font-body text-lg text-cherryDark"
                  >
                    −
                  </button>
                  <span className="font-display text-base w-6 text-center tabular-nums">
                    {l.quantidade}
                  </span>
                  <button
                    onClick={() => mudarQuantidade(l.chave, l.quantidade + 1)}
                    aria-label={`Mais um ${l.nome}`}
                    className="w-11 h-11 rounded-full border border-cherryLight/60 font-body text-lg text-cherryDark"
                  >
                    +
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---------- Quem pediu ---------- */}
      <section className="mt-8">
        <h2 className="font-display text-lg text-cherryDark">2. Quem pediu</h2>
        <p className="font-body text-xs text-ink/55 mt-1">
          Se ela tem cadastro, procure pelo nome — assim o pedido aparece na conta dela e
          rende pontos. Se não, escreva só o que souber.
        </p>

        {escolhida ? (
          <div className="mt-3 flex items-center justify-between gap-3 bg-white/70 border border-cherryDark/30 rounded-xl px-4 py-3">
            <span className="font-body text-sm min-w-0">
              <strong className="text-cherryDark">{escolhida.nome}</strong>
              <span className="block text-xs text-ink/55">
                {escolhida.email} · 🍒 {escolhida.pontos} pontos
              </span>
            </span>
            <button
              onClick={() => {
                setClienteId("");
                setBuscaCliente("");
              }}
              className="shrink-0 min-h-[44px] px-3 font-body text-sm text-cherryDark underline"
            >
              Trocar
            </button>
          </div>
        ) : (
          <div className="grid gap-2 mt-3">
            <input
              type="search"
              value={buscaCliente}
              onChange={(e) => setBuscaCliente(e.target.value)}
              placeholder="Procurar cliente cadastrada (nome, e-mail ou telefone)"
              className="w-full border border-cherryLight/50 rounded-xl px-4 py-3 bg-white/70 font-body text-sm focus:outline-none focus:ring-2 focus:ring-cherryDark"
            />

            {encontrados.map((p) => (
              <button
                key={p.id}
                onClick={() => setClienteId(p.id)}
                className="text-left min-h-[44px] rounded-xl border border-cherryLight/40 bg-white/70 px-4 py-2 font-body text-sm hover:border-cherryDark"
              >
                {p.nome}
                <span className="block text-xs text-ink/55">{p.email}</span>
              </button>
            ))}

            <div className="grid sm:grid-cols-2 gap-2 mt-1">
              <input
                value={nomeContato}
                onChange={(e) => setNomeContato(e.target.value)}
                placeholder="Ou só o nome dela"
                className="w-full border border-cherryLight/50 rounded-xl px-4 py-3 bg-white/70 font-body text-sm focus:outline-none focus:ring-2 focus:ring-cherryDark"
              />
              <input
                value={telefoneContato}
                onChange={(e) => setTelefoneContato(formatarTelefone(e.target.value))}
                placeholder="WhatsApp (opcional)"
                inputMode="numeric"
                className="w-full border border-cherryLight/50 rounded-xl px-4 py-3 bg-white/70 font-body text-sm focus:outline-none focus:ring-2 focus:ring-cherryDark"
              />
            </div>
          </div>
        )}
      </section>

      {/* ---------- Entrega ---------- */}
      <section className="mt-8">
        <h2 className="font-display text-lg text-cherryDark">3. Como ela recebe</h2>

        <div className="flex gap-2 mt-3">
          {(["retirada", "entrega"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTipoEntrega(t)}
              aria-pressed={tipoEntrega === t}
              className={`flex-1 min-h-[44px] rounded-full font-body text-sm border transition-colors ${
                tipoEntrega === t
                  ? "bg-cherryDark text-white border-cherryDark"
                  : "bg-white/70 text-ink/70 border-cherryLight/50"
              }`}
            >
              {t === "retirada" ? "Retirada / balcão" : "Entrega"}
            </button>
          ))}
        </div>

        {tipoEntrega === "entrega" && (
          <div className="grid gap-2 mt-3">
            <input
              value={enderecoTexto}
              onChange={(e) => setEnderecoTexto(e.target.value)}
              placeholder="Endereço da entrega (do jeito que ela passou)"
              className="w-full border border-cherryLight/50 rounded-xl px-4 py-3 bg-white/70 font-body text-sm focus:outline-none focus:ring-2 focus:ring-cherryDark"
            />
            <label className="font-body text-sm text-ink/70">
              Frete que você vai cobrar
              <CampoNumero
                valor={valorFrete}
                onChange={(v) => setValorFrete(v ?? 0)}
                className="mt-1"
              />
            </label>
          </div>
        )}
      </section>

      {/* ---------- Dinheiro ---------- */}
      <section className="mt-8">
        <h2 className="font-display text-lg text-cherryDark">4. O acerto</h2>

        <label className="block font-body text-sm text-ink/70 mt-3">
          Desconto que você deu (se deu)
          <CampoNumero
            valor={desconto}
            onChange={(v) => setDesconto(v ?? 0)}
            className="mt-1"
          />
        </label>

        <div className="grid gap-1.5 mt-4">
          {SITUACOES.map((s) => (
            <button
              key={s.valor}
              onClick={() => setStatus(s.valor)}
              aria-pressed={status === s.valor}
              className={`text-left min-h-[44px] rounded-xl border px-4 py-2 font-body text-sm transition-colors ${
                status === s.valor
                  ? "border-cherryDark bg-blush/50"
                  : "border-cherryLight/40 bg-white/70"
              }`}
            >
              <strong className="text-cherryDark">{s.label}</strong>
              <span className="block text-xs text-ink/55">{s.dica}</span>
            </button>
          ))}
        </div>

        <p className="font-body text-xs text-ink/55 mt-3">
          Estes pedidos entram como <strong>dinheiro</strong>, sem taxa de gateway — é
          assim que suas métricas separam a venda de balcão da venda do site.
        </p>
      </section>

      {/* ---------- Total e salvar ---------- */}
      <div className="mt-8 bg-white/70 border border-cherryLight/50 rounded-2xl p-4">
        <div className="flex justify-between font-body text-sm text-ink/70">
          <span>Doces</span>
          <span className="tabular-nums">{reais(subtotal)}</span>
        </div>
        {desconto > 0 && (
          <div className="flex justify-between font-body text-sm text-cherryDark mt-1">
            <span>Desconto</span>
            <span className="tabular-nums">− {reais(Math.min(desconto, subtotal))}</span>
          </div>
        )}
        {tipoEntrega === "entrega" && (
          <div className="flex justify-between font-body text-sm text-ink/70 mt-1">
            <span>Entrega</span>
            <span className="tabular-nums">{valorFrete > 0 ? reais(valorFrete) : "Grátis"}</span>
          </div>
        )}
        <div className="flex justify-between font-display text-lg mt-2">
          <span>Total</span>
          <span className="tabular-nums">{reais(total)}</span>
        </div>
      </div>

      <button
        onClick={salvar}
        disabled={salvando || linhas.length === 0}
        className="w-full mt-4 bg-cherryDark text-white rounded-2xl px-5 py-4 font-body font-semibold hover:bg-cherryMid transition-colors disabled:opacity-40"
      >
        {salvando ? "Salvando..." : "Lançar pedido"}
      </button>
    </main>
  );
}
