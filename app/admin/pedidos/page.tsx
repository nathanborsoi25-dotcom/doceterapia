"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  atualizarPedido,
  getCarrinhosAbandonados,
  getPedidos,
  tentarEstorno,
  type CarrinhoAbandonado,
} from "@/lib/api";
import CampoNumero from "@/components/CampoNumero";
import VoltarAoPainel from "@/components/VoltarAoPainel";
import { linkWhatsAppNumero } from "@/lib/contato";
import { reais } from "@/lib/formato";
import { mensagemCarrinhoAbandonado, mensagemDeStatus } from "@/lib/mensagens-whatsapp";
import {
  dentroDoPeriodo,
  intervaloDoPeriodo,
  type FiltroPeriodo,
} from "@/lib/periodo";
import { situacaoPrazo } from "@/lib/prazo";
import type { PedidoDoPainel, StatusPedido } from "@/lib/types";

const STATUS: { valor: StatusPedido; label: string }[] = [
  { valor: "aguardando_pagamento", label: "Aguardando pagamento" },
  { valor: "pago", label: "Pago" },
  { valor: "em_preparo", label: "Em preparo" },
  { valor: "pronto", label: "Pronto" },
  { valor: "a_caminho", label: "A caminho" },
  { valor: "concluido", label: "Entregue" },
  { valor: "cancelado", label: "Cancelado" },
];

const PAGAMENTO: Record<PedidoDoPainel["formaPagamento"], string> = {
  pix: "Pix",
  credito: "Crédito",
  debito: "Débito",
  /** Só nos pedidos que ela lança à mão: venda de balcão, sem gateway. */
  dinheiro: "Dinheiro",
};

/** Pedido nestes estados não corre mais contra o prazo. */
const ENCERRADOS: StatusPedido[] = ["concluido", "cancelado"];

/**
 * O que a próxima etapa do pedido significa, pro botão de um clique só.
 *
 * A partir de "pronto" o caminho se divide, e por isso isto é função e não
 * tabela: quem vem buscar nunca passa por "a caminho" — oferecer esse botão
 * numa retirada faria a Camily avisar que saiu para entrega um pedido que
 * está esperando na bancada dela.
 */
function proximaEtapa(
  status: StatusPedido,
  tipoEntrega: PedidoDoPainel["tipoEntrega"]
): { proximo: StatusPedido; rotulo: string } | null {
  const ehEntrega = tipoEntrega === "entrega";

  switch (status) {
    case "pago":
      return { proximo: "em_preparo", rotulo: "Avisar que comecei a preparar" };
    case "em_preparo":
      return { proximo: "pronto", rotulo: "Avisar que ficou pronto" };
    case "pronto":
      return ehEntrega
        ? { proximo: "a_caminho", rotulo: "Avisar que saiu para entrega" }
        : { proximo: "concluido", rotulo: "Avisar que foi retirado" };
    case "a_caminho":
      return { proximo: "concluido", rotulo: "Avisar que foi entregue" };
    default:
      return null;
  }
}

type Filtro = StatusPedido | "todos" | "abandonados";

const PERIODOS: { valor: FiltroPeriodo; label: string }[] = [
  { valor: "sempre", label: "Todo o período" },
  { valor: "hoje", label: "Hoje" },
  { valor: "semana", label: "Últimos 7 dias" },
  { valor: "mes", label: "Últimos 30 dias" },
  { valor: "escolhido", label: "Escolher datas" },
];

export default function AdminPedidosPage() {
  const [pedidos, setPedidos] = useState<PedidoDoPainel[]>([]);
  const [abandonados, setAbandonados] = useState<CarrinhoAbandonado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvandoLink, setSalvandoLink] = useState<string | null>(null);
  const [estornando, setEstornando] = useState<string | null>(null);
  /** Qual pedido está com a tela de "quanto devolver" aberta. */
  const [cancelando, setCancelando] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  /*
   * A home do painel manda links como `/admin/pedidos?situacao=pago` — e até
   * agora essa parte do endereço era ignorada: ela tocava em "2 pedidos pagos
   * esperando você começar" e caía na lista inteira, tendo que achar de novo
   * o que o aviso já sabia.
   *
   * Lido do `window` num efeito, e não por `useSearchParams`, que exigiria
   * embrulhar a tela num `Suspense` só por causa disto.
   */
  useEffect(() => {
    const pedido = new URLSearchParams(window.location.search).get("situacao");
    if (!pedido) return;
    const conhecido =
      pedido === "abandonados" || STATUS.some((s) => s.valor === pedido);
    if (conhecido) setFiltro(pedido as Filtro);
  }, []);

  /** Recorte de tempo. Começa aberto: ela quer ver tudo ao entrar. */
  const [periodo, setPeriodo] = useState<FiltroPeriodo>("sempre");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");

  useEffect(() => {
    Promise.all([
      getPedidos().catch(() => []),
      getCarrinhosAbandonados().catch(() => []),
    ])
      .then(([p, c]) => {
        setPedidos(p);
        setAbandonados(c);
      })
      .finally(() => setCarregando(false));
  }, []);

  async function recarregar() {
    const novos = await getPedidos().catch(() => null);
    if (novos) setPedidos(novos);
  }

  async function mudarStatus(
    id: string,
    status: StatusPedido,
    valorReembolso?: number
  ) {
    /*
     * Cancelar é a única mudança que mexe com dinheiro. Quando o pedido já
     * foi pago, quem decide quanto devolver é a Camily — a escolha acontece
     * no cartão do pedido (`EscolherReembolso`), então aqui só chega o valor
     * já decidido. Sem pagamento não há o que devolver: pergunta simples.
     */
    if (status === "cancelado" && valorReembolso === undefined) {
      const p = pedidos.find((x) => x.id === id);
      const jaPago = p ? p.status !== "aguardando_pagamento" : false;
      if (jaPago) {
        // Abre a escolha do valor em vez de cancelar direto.
        setCancelando(id);
        return;
      }
      const ok = window.confirm(
        "Cancelar este pedido? Ninguém chegou a pagar, então não há valor a devolver."
      );
      if (!ok) return;
    }

    const anterior = pedidos;
    setPedidos((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    setAviso("");
    try {
      await atualizarPedido(id, { status, valorReembolso });
      // Depois de cancelar, recarrega pra saber se o estorno saiu ou falhou.
      if (status === "cancelado") {
        setCancelando(null);
        await recarregar();
      }
    } catch (e) {
      setPedidos(anterior);
      setAviso(e instanceof Error ? e.message : "Não foi possível atualizar o pedido.");
    }
  }

  async function estornarDeNovo(id: string) {
    setEstornando(id);
    setAviso("");
    try {
      await tentarEstorno(id);
      await recarregar();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "Não foi possível estornar.");
    } finally {
      setEstornando(null);
    }
  }

  /**
   * Guarda o link de acompanhamento do Uber. Salvar aqui NÃO dispara e-mail;
   * o link entra no aviso quando ela marcar o pedido como "A caminho".
   */
  async function salvarRastreio(id: string, linkRastreio: string) {
    setSalvandoLink(id);
    try {
      await atualizarPedido(id, { linkRastreio });
      setPedidos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, linkRastreio } : p))
      );
    } finally {
      setSalvandoLink(null);
    }
  }

  function total(p: PedidoDoPainel) {
    const subtotal = p.itens.reduce((a, i) => a + i.precoUnitario * i.quantidade, 0);
    // Os descontos entram na conta: é o valor que de fato foi cobrado, e é
    // ele que manda no quanto dá pra devolver num cancelamento.
    return Math.max(
      0,
      subtotal + p.valorFrete - (p.desconto ?? 0) - (p.descontoPix ?? 0)
    );
  }

  /**
   * O recorte de tempo vem ANTES de tudo: as contagens de cada situação
   * precisam falar do mesmo conjunto que a lista mostra, senão o filtro diz
   * "Pago (5)" e aparecem dois.
   */
  const intervalo = useMemo(
    () => intervaloDoPeriodo(periodo, de, ate),
    [periodo, de, ate]
  );

  const doPeriodo = useMemo(
    () => pedidos.filter((p) => dentroDoPeriodo(p.criadoEm, intervalo)),
    [pedidos, intervalo]
  );

  const abandonadosDoPeriodo = useMemo(
    () => abandonados.filter((c) => dentroDoPeriodo(c.atualizadoEm, intervalo)),
    [abandonados, intervalo]
  );

  /**
   * Ordena pelo prazo: o que está vencido ou mais apertado vem primeiro.
   * Pedidos já entregues ou cancelados descem para o fim da lista.
   */
  const ordenados = useMemo(() => {
    return [...doPeriodo].sort((a, b) => {
      const aFim = ENCERRADOS.includes(a.status);
      const bFim = ENCERRADOS.includes(b.status);
      if (aFim !== bFim) return aFim ? 1 : -1;
      const pa = a.prazoEm ? new Date(a.prazoEm).getTime() : Infinity;
      const pb = b.prazoEm ? new Date(b.prazoEm).getTime() : Infinity;
      return pa - pb;
    });
  }, [doPeriodo]);

  const visiveis = useMemo(
    () =>
      filtro === "todos" || filtro === "abandonados"
        ? ordenados
        : ordenados.filter((p) => p.status === filtro),
    [ordenados, filtro]
  );

  const vencidos = ordenados.filter(
    (p) => situacaoPrazo(p.prazoEm, { encerrado: ENCERRADOS.includes(p.status) })?.vencido
  ).length;

  /** Quantos pedidos há em cada situação, pro número aparecer no filtro. */
  const contagem = useMemo(() => {
    const c: Record<string, number> = {
      todos: doPeriodo.length,
      abandonados: abandonadosDoPeriodo.length,
    };
    for (const s of STATUS) c[s.valor] = doPeriodo.filter((p) => p.status === s.valor).length;
    return c;
  }, [doPeriodo, abandonadosDoPeriodo]);

  /** Quanto entrou no recorte, sem contar o que foi cancelado. */
  const faturamentoDoPeriodo = useMemo(
    () =>
      doPeriodo
        .filter((p) => p.status !== "cancelado" && p.status !== "aguardando_pagamento")
        .reduce((soma, p) => soma + total(p), 0),
    [doPeriodo]
  );

  const filtros: { valor: Filtro; label: string }[] = [
    { valor: "todos", label: "Todos" },
    ...STATUS.map((s) => ({ valor: s.valor as Filtro, label: s.label })),
    { valor: "abandonados", label: "Carrinho abandonado" },
  ];

  return (
    <main className="min-h-screen px-4 sm:px-6 md:px-12 py-8 md:py-10 max-w-3xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl sm:text-3xl text-cherryDark">Meus pedidos</h1>
        <div className="flex items-center gap-3">
          {/* Venda que não nasceu no site: balcão, WhatsApp, encontro na rua. */}
          <Link
            href="/admin/pedidos/novo"
            className="text-sm text-cherryDark underline font-body py-3"
          >
            + Novo pedido
          </Link>
          <VoltarAoPainel />
        </div>
      </div>
      <p className="text-sm font-body text-ink/60 mt-1">
        Em ordem de prazo — o mais urgente primeiro.
        {vencidos > 0 && (
          <span className="text-cherryDark font-semibold">
            {" "}
            {vencidos} {vencidos === 1 ? "está vencido" : "estão vencidos"}.
          </span>
        )}
      </p>

      {/* Recorte de tempo. Fica ACIMA dos filtros de situação porque manda
          neles: as contagens ali embaixo já saem contando só este período. */}
      <div className="mt-4 grid gap-2">
        <div className="flex gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          {PERIODOS.map((p) => (
            <button
              key={p.valor}
              onClick={() => setPeriodo(p.valor)}
              className={`shrink-0 px-4 py-2.5 rounded-full text-sm font-body border transition-colors ${
                periodo === p.valor
                  ? "bg-blush border-cherryDark text-cherryDark font-semibold"
                  : "bg-white/70 text-ink/70 border-cherryLight/50 hover:border-cherryMid"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {periodo === "escolhido" && (
          <div className="flex flex-wrap items-end gap-2 bg-white/70 border border-cherryLight/30 rounded-2xl p-3">
            <label className="grid gap-1 text-xs font-body text-ink/60">
              De
              <input
                type="date"
                value={de}
                max={ate || undefined}
                onChange={(e) => setDe(e.target.value)}
                className="border border-cherryLight/40 rounded-lg p-2 bg-white/70 font-body text-sm"
              />
            </label>
            <label className="grid gap-1 text-xs font-body text-ink/60">
              Até
              <input
                type="date"
                value={ate}
                min={de || undefined}
                onChange={(e) => setAte(e.target.value)}
                className="border border-cherryLight/40 rounded-lg p-2 bg-white/70 font-body text-sm"
              />
            </label>
            {(de || ate) && (
              <button
                onClick={() => {
                  setDe("");
                  setAte("");
                }}
                className="text-xs font-body text-ink/50 underline inline-flex items-center min-h-[44px] px-1"
              >
                limpar
              </button>
            )}
            <p className="basis-full text-xs font-body text-ink/45">
              Pode preencher só um lado: com &ldquo;De&rdquo; você vê daquele
              dia em diante; para um dia só, repita a mesma data nos dois.
            </p>
          </div>
        )}

        {intervalo && (
          <p className="text-xs font-body text-ink/55">
            {contagem.todos === 0
              ? "Nenhum pedido nesse período."
              : `${contagem.todos} ${contagem.todos === 1 ? "pedido" : "pedidos"} no período · ${reais(faturamentoDoPeriodo)} (sem contar cancelados e não pagos)`}
          </p>
        )}
      </div>

      {/* Filtros: rolam na horizontal no celular, sem espremer os botões */}
      {/* No celular a fileira rola de lado; da largura de tablet pra cima ela
          quebra em linhas. Sem isso os filtros da direita ficavam escondidos
          fora da tela, e agora que a barra de rolagem some ninguém adivinha
          que existe mais coisa ali. */}
      <div className="flex gap-2 mt-4 overflow-x-auto sm:flex-wrap sm:overflow-visible pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
        {filtros.map((f) => (
          <button
            key={f.valor}
            onClick={() => setFiltro(f.valor)}
            className={`shrink-0 px-4 py-2.5 rounded-full text-sm font-body border transition-colors ${
              filtro === f.valor
                ? "bg-cherryDark text-white border-cherryDark"
                : "bg-white/70 text-ink/70 border-cherryLight/50 hover:border-cherryDark"
            }`}
          >
            {f.label}
            {contagem[f.valor] > 0 && (
              <span className={filtro === f.valor ? "opacity-80" : "text-ink/40"}>
                {" "}
                ({contagem[f.valor]})
              </span>
            )}
          </button>
        ))}
      </div>

      {aviso && (
        <p className="mt-4 text-sm font-body text-cherryDark bg-blush/70 border border-cherryLight/50 rounded-xl px-4 py-3">
          {aviso}
        </p>
      )}

      {carregando && <p className="text-ink/60 font-body mt-6">Carregando...</p>}

      {/* Carrinhos que não viraram pedido */}
      {!carregando && filtro === "abandonados" && (
        <div className="grid gap-4 mt-2">
          <p className="text-sm font-body text-ink/60">
            Pessoas que escolheram doces e não finalizaram. Um toque no WhatsApp
            costuma resgatar a venda.
          </p>
          {abandonadosDoPeriodo.length === 0 && (
            <p className="text-ink/60 font-body">
              {intervalo
                ? "Nenhum carrinho parado nesse período. 🍒"
                : "Nenhum carrinho parado no momento. 🍒"}
            </p>
          )}
          {abandonadosDoPeriodo.map((c) => (
            <div
              key={c.clienteId}
              className="bg-white/70 border border-cherryLight/30 rounded-2xl p-3 sm:p-4 grid gap-2 font-body text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-ink/80">
                  {c.clienteNome ?? "Cliente"}
                  {c.clienteTelefone && (
                    <span className="text-ink/50"> · {c.clienteTelefone}</span>
                  )}
                </span>
                <span className="font-display text-base text-cherryDark">
                  {reais(c.total)}
                </span>
              </div>
              <ul className="text-ink/80">
                {c.itens.map((i) => (
                  <li key={`${i.produtoId}-${i.saborId ?? ""}`}>
                    {i.quantidade}× {i.nome}
                    {i.saborNome && <span className="text-cherryMid"> · {i.saborNome}</span>}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-ink/45">
                parado desde {new Date(c.atualizadoEm).toLocaleString("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </p>
              {c.clienteTelefone && (
                <BotaoWhats
                  telefone={c.clienteTelefone}
                  mensagem={mensagemCarrinhoAbandonado(c.clienteNome)}
                  rotulo="Chamar no WhatsApp"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lista de pedidos */}
      {!carregando && filtro !== "abandonados" && (
        <div className="grid gap-4 mt-2">
          {visiveis.length === 0 && (
            <p className="text-ink/60 font-body">
              {intervalo
                ? "Nenhum pedido nesta situação dentro do período escolhido."
                : "Nenhum pedido nesta situação."}
            </p>
          )}

          {visiveis.map((p) => {
            const encerrado = ENCERRADOS.includes(p.status);
            const prazo = situacaoPrazo(p.prazoEm, { encerrado });
            const telefone = p.clienteTelefone ?? "";
            const etapa = proximaEtapa(p.status, p.tipoEntrega);
            const mensagem = etapa
              ? mensagemDeStatus(etapa.proximo, {
                  nome: p.clienteNome,
                  tipoEntrega: p.tipoEntrega,
                  linkRastreio: p.linkRastreio,
                })
              : null;

            return (
              <div
                key={p.id}
                className={`bg-white/70 border rounded-2xl p-3 sm:p-4 grid gap-2 font-body text-sm ${
                  prazo?.vencido ? "border-cherryDark border-2" : "border-cherryLight/30"
                }`}
              >
                {/* Prazo em destaque: é a informação que ela olha primeiro */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {prazo ? (
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        prazo.vencido
                          ? "bg-cherryDark text-white"
                          : encerrado
                            ? "bg-ink/10 text-ink/60"
                            : prazo.diasRestantes <= 1
                              ? "bg-amber-100 text-amber-800"
                              : "bg-green-100 text-green-800"
                      }`}
                    >
                      {prazo.vencido ? `VENCIDO — ${prazo.rotulo}` : `Prazo: ${prazo.rotulo}`}
                    </span>
                  ) : (
                    <span className="text-xs text-ink/40">sem prazo definido</span>
                  )}
                  <span className="font-display text-base text-cherryDark">
                    {reais(total(p))}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-cherryLight/20 pt-2">
                  <span className="text-ink/80">
                    {p.clienteNome ?? "Cliente"}
                    {telefone && <span className="text-ink/50"> · {telefone}</span>}
                  </span>
                  {telefone && (
                    <BotaoWhats
                      telefone={telefone}
                      mensagem={`Oi, ${(p.clienteNome ?? "").split(" ")[0]}! Aqui é a Camily, da Doceterapia 🍒`}
                      rotulo="WhatsApp"
                      pequeno
                    />
                  )}
                </div>

                {/* O recheio vem em destaque: é o que muda o que ela faz na
                    cozinha, então não pode ficar escondido no meio da linha. */}
                <ul className="text-ink/80">
                  {p.itens.map((i) => (
                    <li key={`${i.produtoId}-${i.saborId ?? ""}`}>
                      {i.quantidade}× {i.nome}
                      {i.saborNome && (
                        <strong className="text-cherryDark"> · {i.saborNome}</strong>
                      )}{" "}
                      — {reais(i.precoUnitario)}
                    </li>
                  ))}
                </ul>

                <p className="text-ink/70">
                  {p.tipoEntrega === "entrega" ? "Entrega" : "Retirada"}
                  {p.dataAgendada
                    ? ` · ${new Date(p.dataAgendada).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`
                    : ""}{" "}
                  · {PAGAMENTO[p.formaPagamento]}
                  {p.valorFrete > 0 && ` · Frete ${reais(p.valorFrete)}`}
                  {(p.desconto ?? 0) > 0 &&
                    ` · Cupom ${p.cupomCodigo ?? ""} −${reais(p.desconto)}`}
                  {(p.descontoPix ?? 0) > 0 &&
                    ` · Desconto Pix −${reais(p.descontoPix)}`}
                </p>

                {/* Onde ela escolheu buscar: é o que a Camily precisa saber
                    pra combinar o horário no WhatsApp. */}
                {p.pontoRetirada && (
                  <p className="bg-white/80 border border-cherryLight/40 rounded-xl px-3 py-2 text-ink/80">
                    📍 <strong>Busca em:</strong> {p.pontoRetirada}
                  </p>
                )}

                {/* Presente e bilhete em destaque: mudam o que ela faz na
                    entrega e o que escreve no cartão. */}
                {p.ehPresente && (
                  <p className="bg-blush/70 border border-cherryLight/50 rounded-xl px-3 py-2 text-ink/80">
                    🎁 <strong>É presente</strong>
                    {p.nomeQuemRecebe && (
                      <>
                        {" "}
                        — entregar para{" "}
                        <strong className="text-cherryDark">{p.nomeQuemRecebe}</strong>
                      </>
                    )}
                  </p>
                )}

                {p.bilhete && (
                  <div className="bg-white border border-cherryLight/50 rounded-xl px-3 py-2.5">
                    <p className="text-xs text-cherryMid font-semibold mb-1">
                      Bilhete para escrever no cartão:
                    </p>
                    <p className="font-display text-base text-ink whitespace-pre-wrap">
                      &ldquo;{p.bilhete}&rdquo;
                    </p>
                  </div>
                )}

                {p.tipoEntrega === "entrega" && p.enderecoEntrega && (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-ink/60">
                      {p.enderecoEntrega.rua}, {p.enderecoEntrega.numero} —{" "}
                      {p.enderecoEntrega.bairro}, {p.enderecoEntrega.cidade}
                      {p.enderecoEntrega.complemento && (
                        <span className="text-ink/45">
                          {" "}
                          ({p.enderecoEntrega.complemento})
                        </span>
                      )}
                    </p>
                    <CopiarEndereco
                      texto={`${p.enderecoEntrega.rua}, ${p.enderecoEntrega.numero}`}
                    />
                  </div>
                )}

                {/* Cancelado: o que aconteceu com o dinheiro. O "falhou"
                    aparece em vermelho porque exige ação dela. */}
                {p.status === "cancelado" && p.statusReembolso && (
                  <div
                    className={`rounded-xl px-3 py-2.5 text-xs grid gap-2 ${
                      p.statusReembolso === "falhou"
                        ? "bg-cherryDark/10 border border-cherryDark/40 text-cherryDark"
                        : "bg-blush/60 border border-cherryLight/30 text-ink/70"
                    }`}
                  >
                    <span>
                      {p.statusReembolso === "concluido" &&
                        `Dinheiro devolvido pelo Mercado Pago${p.valorReembolsado ? ` (${reais(p.valorReembolsado)})` : ""}.`}
                      {p.statusReembolso === "nao_precisa" &&
                        "Ninguém tinha pago — não havia valor a devolver."}
                      {p.statusReembolso === "falhou" && (
                        <strong>
                          O estorno NÃO saiu. Tente de novo ou devolva pelo site
                          do Mercado Pago e avise o cliente.
                        </strong>
                      )}
                      {p.canceladoPor === "cliente" && " Cancelado pelo cliente."}
                    </span>
                    {p.statusReembolso === "falhou" && (
                      <button
                        onClick={() => estornarDeNovo(p.id)}
                        disabled={estornando === p.id}
                        className="justify-self-start bg-cherryDark text-white rounded-full px-4 py-2.5 font-semibold disabled:opacity-50"
                      >
                        {estornando === p.id ? "Tentando..." : "Tentar estorno de novo"}
                      </button>
                    )}
                  </div>
                )}

                {/* Quanto devolver. Abre quando ela escolhe "Cancelado" num
                    pedido já pago — é a hora de decidir se o frete volta. */}
                {cancelando === p.id && (
                  <EscolherReembolso
                    total={total(p)}
                    valorFrete={p.valorFrete}
                    onCancelar={(valor) => mudarStatus(p.id, "cancelado", valor)}
                    onDesistir={() => setCancelando(null)}
                  />
                )}

                {p.tipoEntrega === "entrega" && !encerrado && (
                  <LinkRastreio
                    valorInicial={p.linkRastreio ?? ""}
                    salvando={salvandoLink === p.id}
                    onSalvar={(link) => salvarRastreio(p.id, link)}
                  />
                )}

                {/* Um clique: avisa no WhatsApp E adianta a situação */}
                {etapa && mensagem && telefone && (
                  <a
                    href={linkWhatsAppNumero(telefone, mensagem)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => mudarStatus(p.id, etapa.proximo)}
                    className="mt-1 inline-flex items-center justify-center gap-2 bg-[#25D366] text-white rounded-full px-4 py-3 text-sm font-semibold hover:brightness-95 transition text-center"
                  >
                    {etapa.rotulo}
                  </a>
                )}

                <label className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="text-ink/60">Situação:</span>
                  <select
                    value={p.status}
                    onChange={(e) => mudarStatus(p.id, e.target.value as StatusPedido)}
                    className="border border-cherryLight/40 rounded-lg p-2 bg-white/70"
                  >
                    {STATUS.map((s) => (
                      <option key={s.valor} value={s.valor}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-ink/40">
                    feito em {new Date(p.criadoEm).toLocaleDateString("pt-BR")}
                  </span>
                </label>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

/**
 * Quanto devolver ao cancelar um pedido já pago.
 *
 * Antes o site sempre estornava o valor inteiro, e não havia como fazer
 * diferente pelo painel — quando o entregador já tinha rodado, o frete ia
 * junto e saía do bolso da Camily. Agora ela escolhe: tudo, só os doces, ou
 * um valor combinado com a cliente.
 *
 * O estorno vai pro Mercado Pago na hora e não tem desfazer, por isso a
 * confirmação é um passo separado e o valor aparece escrito no botão.
 */
function EscolherReembolso({
  total,
  valorFrete,
  onCancelar,
  onDesistir,
}: {
  total: number;
  valorFrete: number;
  onCancelar: (valor: number) => void;
  onDesistir: () => void;
}) {
  type Escolha = "tudo" | "sem_frete" | "outro" | "nada";
  const [escolha, setEscolha] = useState<Escolha>("tudo");
  const [outro, setOutro] = useState<number | null>(null);

  const semFrete = Math.max(0, total - valorFrete);
  const valor =
    escolha === "tudo"
      ? total
      : escolha === "sem_frete"
        ? semFrete
        : escolha === "nada"
          ? 0
          : Math.min(outro ?? 0, total);

  const opcoes: { valor: Escolha; label: string; ajuda: string }[] = [
    { valor: "tudo", label: `Tudo · ${reais(total)}`, ajuda: "Doces e entrega." },
    ...(valorFrete > 0
      ? [
          {
            valor: "sem_frete" as Escolha,
            label: `Só os doces · ${reais(semFrete)}`,
            ajuda: `A entrega de ${reais(valorFrete)} não volta.`,
          },
        ]
      : []),
    { valor: "outro", label: "Outro valor", ajuda: "Um combinado com o cliente." },
    { valor: "nada", label: "Não devolver nada", ajuda: "Nenhum estorno é pedido." },
  ];

  return (
    <div className="bg-blush/60 border border-cherryDark/30 rounded-2xl p-3 grid gap-2">
      <p className="font-semibold text-cherryDark">
        Quanto você quer devolver para o cliente?
      </p>

      <div className="grid gap-1.5">
        {opcoes.map((o) => (
          <label
            key={o.valor}
            className={`flex items-start gap-2 rounded-xl px-3 py-2.5 border cursor-pointer ${
              escolha === o.valor
                ? "bg-white border-cherryDark"
                : "bg-white/60 border-cherryLight/40"
            }`}
          >
            <input
              type="radio"
              name="reembolso"
              checked={escolha === o.valor}
              onChange={() => setEscolha(o.valor)}
              className="mt-0.5 accent-cherryDark"
            />
            <span className="min-w-0">
              <span className="block text-ink/85 font-semibold">{o.label}</span>
              <span className="block text-xs text-ink/55">{o.ajuda}</span>
            </span>
          </label>
        ))}
      </div>

      {escolha === "outro" && (
        <label className="grid gap-1 text-xs text-ink/60">
          Valor a devolver (R$) — no máximo {reais(total)}
          <CampoNumero
            valor={outro}
            onChange={setOutro}
            placeholder="0,00"
            className="w-full sm:w-48 border border-cherryLight/50 rounded-lg p-2 bg-white/70 text-sm font-body"
          />
        </label>
      )}

      <p className="text-xs text-ink/60">
        O pedido é cancelado de qualquer jeito, o cliente é avisado por e-mail e
        os doces voltam para o estoque. O estorno não tem como desfazer.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onCancelar(valor)}
          disabled={escolha === "outro" && (outro ?? 0) <= 0}
          className="bg-cherryDark text-white rounded-full px-5 py-3 font-semibold disabled:opacity-40"
        >
          {valor > 0
            ? `Cancelar e devolver ${reais(valor)}`
            : "Cancelar sem devolver nada"}
        </button>
        <button
          onClick={onDesistir}
          className="text-ink/60 underline px-3 py-3 min-h-[44px]"
        >
          Voltar
        </button>
      </div>
    </div>
  );
}

/** Botão verde que abre a conversa do cliente com a mensagem já escrita. */
function BotaoWhats({
  telefone,
  mensagem,
  rotulo,
  pequeno,
}: {
  telefone: string;
  mensagem: string;
  rotulo: string;
  pequeno?: boolean;
}) {
  return (
    <a
      href={linkWhatsAppNumero(telefone, mensagem)}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 bg-[#25D366] text-white rounded-full font-semibold hover:brightness-95 transition ${
        pequeno ? "px-4 py-3 text-xs" : "px-4 py-3 text-sm justify-center"
      }`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="w-3.5 h-3.5 fill-current">
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.02a8.2 8.2 0 0 1-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.37c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.41a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.22-8.24 8.22z" />
        <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.76-1.66-2.06-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.38-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35z" />
      </svg>
      {rotulo}
    </a>
  );
}

/**
 * Campo do link de acompanhamento da entrega. A Camily copia o link do app
 * do Uber Envios e cola aqui; ao marcar o pedido como "A caminho", esse link
 * vai dentro do e-mail e da mensagem de WhatsApp.
 */
function LinkRastreio({
  valorInicial,
  salvando,
  onSalvar,
}: {
  valorInicial: string;
  salvando: boolean;
  onSalvar: (link: string) => void;
}) {
  const [valor, setValor] = useState(valorInicial);
  const mudou = valor.trim() !== valorInicial.trim();

  return (
    <div className="border-t border-cherryLight/20 pt-2 grid gap-1.5">
      <label className="text-xs text-ink/60">
        Link de acompanhamento da entrega (Uber)
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          type="url"
          inputMode="url"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="Cole aqui o link do Uber Envios"
          className="flex-1 min-w-0 border border-cherryLight/40 rounded-lg p-2 text-sm bg-white/70"
        />
        <button
          onClick={() => onSalvar(valor.trim())}
          disabled={!mudou || salvando}
          className="text-sm bg-cherryDark text-white rounded-full px-4 py-2.5 font-semibold disabled:opacity-40"
        >
          {salvando ? "Salvando..." : "Salvar link"}
        </button>
      </div>
      <span className="text-xs text-ink/45">
        {valorInicial
          ? "O cliente recebe este link quando você avisar que saiu para entrega."
          : "Opcional. Se preencher, o cliente acompanha a entrega."}
      </span>
    </div>
  );
}

/**
 * Copia só "Rua, número" — que é o formato que o Uber Envios entende no
 * campo de endereço. Evita a Camily ter que selecionar o texto na mão no
 * celular, que é justamente onde isso é chato de fazer.
 */
function CopiarEndereco({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      // Navegador antigo ou sem permissão: usa o jeito tradicional.
      const campo = document.createElement("textarea");
      campo.value = texto;
      campo.style.position = "fixed";
      campo.style.opacity = "0";
      document.body.appendChild(campo);
      campo.select();
      document.execCommand("copy");
      campo.remove();
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <button
      onClick={copiar}
      className={`shrink-0 text-xs font-semibold rounded-full px-3 py-3 border transition-colors ${
        copiado
          ? "bg-green-100 text-green-800 border-green-200"
          : "text-cherryDark border-cherryLight/50 hover:bg-blush"
      }`}
    >
      {copiado ? "Copiado!" : "Copiar endereço"}
    </button>
  );
}
