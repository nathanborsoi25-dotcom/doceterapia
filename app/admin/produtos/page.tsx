"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AvisoSalvo from "@/components/AvisoSalvo";
import CampoNumero from "@/components/CampoNumero";
import EditorSabores from "@/components/EditorSabores";
import GaleriaFotos from "@/components/GaleriaFotos";
import VoltarAoPainel from "@/components/VoltarAoPainel";
import {
  getCategorias,
  getProdutos,
  removerProduto,
  upsertProduto,
  type CategoriaDoPainel,
} from "@/lib/api";
import {
  categoriaDoProduto,
  categoriasDe,
  combinaComBusca,
  resumoDeEstoqueTexto,
  resumoDePreco,
  situacaoDoEstoque,
} from "@/lib/catalogo";
import {
  desdeQuando,
  estaPausado,
  quantosNaPausa,
  type PausaProntaEntrega,
} from "@/lib/pausa-pronta-entrega";
import CampoPromocao from "@/components/CampoPromocao";
import SobraPorUnidade from "@/components/SobraPorUnidade";
import { fotosDoProduto } from "@/lib/fotos";
import { useAvisoSalvo } from "@/lib/usar-aviso-salvo";
import type { Produto, SaborDoDoce } from "@/lib/types";

/** Doce com recheio guarda preço, custo e estoque em cada um deles. */
function temRecheios(produto: Produto): boolean {
  return (produto.sabores ?? []).length > 0;
}

type Ordem = "recentes" | "antigos" | "nome" | "preco";
type FiltroEstoque = "todos" | "disponivel" | "esgotado";

/**
 * Meus produtos.
 *
 * Com poucos doces, uma lista de formulários abertos funcionava. Com o
 * cardápio crescendo vira uma rolagem sem fim, então cada doce aparece numa
 * LINHA compacta (foto, nome, categoria, preço e estoque) e só abre quando a
 * Camily vai mexer nele. Busca e filtros ficam fixos no topo.
 */
export default function AdminProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [abertos, setAbertos] = useState<string[]>([]);
  const { aviso, avisarSalvo, avisarErro } = useAvisoSalvo();

  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const [estoque, setEstoque] = useState<FiltroEstoque>("todos");
  const [ordem, setOrdem] = useState<Ordem>("recentes");
  /** As categorias criadas em /admin/categorias, pra escolher em cada doce. */
  const [categorias, setCategorias] = useState<CategoriaDoPainel[]>([]);

  /** A pausa de "vou sair": nula quando o cardápio está normal. */
  const [pausa, setPausa] = useState<PausaProntaEntrega | null>(null);
  const [mudandoPausa, setMudandoPausa] = useState(false);

  useEffect(() => {
    getProdutos()
      .then(setProdutos)
      .catch(() => setProdutos([]))
      .finally(() => setCarregando(false));
    getCategorias()
      .then(setCategorias)
      .catch(() => setCategorias([]));
    fetch("/api/config-loja", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => setPausa(c?.pausaProntaEntrega ?? null))
      .catch(() => setPausa(null));
  }, []);

  /**
   * O botão de quando ela precisa sair: todo doce de pronta entrega vira
   * encomenda de 1 dia, e volta ao normal com outro toque.
   *
   * Recarrega a lista depois porque os doces na tela acabaram de mudar de
   * disponibilidade no banco — sem isso ela veria "pronta entrega" num
   * cardápio que já está pausado.
   */
  async function alternarPausa(pausar: boolean) {
    setMudandoPausa(true);
    try {
      const r = await fetch("/api/admin/pronta-entrega", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pausar }),
      });
      const corpo = (await r.json()) as { pausa?: PausaProntaEntrega; quantos?: number; error?: string };

      if (!r.ok) {
        avisarErro(corpo.error ?? "Não consegui mudar isso agora. Tente de novo.");
        return;
      }

      setPausa(pausar ? corpo.pausa ?? null : null);
      setProdutos(await getProdutos());
      avisarSalvo(
        pausar
          ? `Prontinho: ${corpo.quantos} ${corpo.quantos === 1 ? "doce está" : "doces estão"} como encomenda de 1 dia. 🍒`
          : "Tudo de volta à pronta entrega. Bom trabalho! 🍒"
      );
    } catch {
      avisarErro("Não consegui mudar isso agora. Confira sua internet e tente de novo.");
    } finally {
      setMudandoPausa(false);
    }
  }

  function handleCampo(
    id: string,
    campo: keyof Produto,
    // `null` é um valor de verdade aqui: é o estoque "não controlado".
    valor: string | number | boolean | null | SaborDoDoce[]
  ) {
    setProdutos((prev) => prev.map((p) => (p.id === id ? { ...p, [campo]: valor } : p)));
  }

  /**
   * A galeria e a foto de capa andam juntas: a capa é sempre a primeira da
   * lista. Guardar as duas coisas em sincronia aqui evita que o cardápio
   * mostre uma foto que já foi removida da galeria.
   */
  function trocarFotos(id: string, fotos: string[]) {
    setProdutos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, fotos, fotoUrl: fotos[0] ?? "" } : p))
    );
  }

  /**
   * Salva o doce e DIZ que salvou.
   *
   * Antes esta função gravava calada: a Camily apertava "Salvar", o botão
   * voltava ao normal e nada mais acontecia — ela não tinha como saber se a
   * mudança foi. Pior, o erro também era mudo: quando a gravação falhava, a
   * tela seguia mostrando o preço novo que o banco nunca recebeu.
   */
  async function salvar(produto: Produto) {
    setSalvandoId(produto.id);
    try {
      await upsertProduto(produto);
      avisarSalvo(`${produto.nome || "O doce"} foi salvo. 🍒`);
    } catch {
      avisarErro(
        `Não consegui salvar ${produto.nome || "o doce"}. Confira sua internet e tente de novo.`
      );
    } finally {
      setSalvandoId(null);
    }
  }

  async function remover(id: string) {
    const doce = produtos.find((p) => p.id === id);
    const certeza = window.confirm(
      `Remover "${doce?.nome ?? "este doce"}" do cardápio? Isso não tem como desfazer.`
    );
    if (!certeza) return;
    await removerProduto(id);
    setProdutos((prev) => prev.filter((p) => p.id !== id));
  }

  function alternar(id: string) {
    setAbertos((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  /** Para o filtro: as criadas mais as que aparecem nos doces. */
  const categoriasParaFiltrar = useMemo(() => {
    const doPainel = categorias.map((c) => c.nome);
    return [...new Set([...doPainel, ...categoriasDe(produtos)])];
  }, [categorias, produtos]);

  const visiveis = useMemo(() => {
    const filtrados = produtos.filter((p) => {
      if (!combinaComBusca(p, busca)) return false;
      if (categoria !== "todas" && categoriaDoProduto(p) !== categoria) return false;
      if (estoque === "esgotado") return situacaoDoEstoque(p) === "esgotado";
      if (estoque === "disponivel") return situacaoDoEstoque(p) !== "esgotado";
      return true;
    });

    const emTempo = (p: Produto) => (p.criadoEm ? new Date(p.criadoEm).getTime() : 0);
    return filtrados.sort((a, b) => {
      if (ordem === "recentes") return emTempo(b) - emTempo(a);
      if (ordem === "antigos") return emTempo(a) - emTempo(b);
      if (ordem === "nome") return a.nome.localeCompare(b.nome, "pt-BR");
      return a.preco - b.preco;
    });
  }, [produtos, busca, categoria, estoque, ordem]);

  const esgotados = produtos.filter((p) => situacaoDoEstoque(p) === "esgotado").length;

  return (
    <main className="min-h-screen px-4 sm:px-6 md:px-12 py-8 md:py-10 max-w-3xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl sm:text-3xl text-cherryDark">Meus produtos</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/produtos/novo"
            className="text-sm text-cherryDark underline font-body py-3"
          >
            + Adicionar produto
          </Link>
          <VoltarAoPainel />
        </div>
      </div>

      <p className="text-sm font-body text-ink/60 mt-1">
        {produtos.length} {produtos.length === 1 ? "doce" : "doces"} no cardápio
        {esgotados > 0 && (
          <span className="text-cherryDark font-semibold">
            {" "}
            · {esgotados} esgotado{esgotados > 1 ? "s" : ""}
          </span>
        )}
      </p>

      {/*
        "Vou sair": o cardápio inteiro passa a prometer 1 dia de preparo.

        Fica aqui em cima, antes da busca, porque é decisão do dia — não algo
        que se procura no meio da lista. Quando está ligado, o aviso ocupa o
        lugar do botão: ela precisa VER que o cardápio está pausado assim que
        abre a tela, senão esquece ligado e some com a pronta entrega.
      */}
      {estaPausado(pausa) ? (
        <div className="mt-4 bg-blush/70 border border-cherryDark/40 rounded-2xl p-4 grid gap-2">
          <p className="font-display text-base text-cherryDark">
            🚪 Cardápio em encomenda de 1 dia
          </p>
          <p className="font-body text-sm text-ink/75">
            {quantosNaPausa(pausa)}{" "}
            {quantosNaPausa(pausa) === 1 ? "item saiu" : "itens saíram"} da pronta entrega
            {desdeQuando(pausa) ? ` desde ${desdeQuando(pausa)}` : ""}. Quem já era encomenda
            continua com o prazo de sempre.
          </p>
          <button
            onClick={() => alternarPausa(false)}
            disabled={mudandoPausa}
            className="justify-self-start bg-cherryDark text-white rounded-full px-5 min-h-[44px] font-body font-semibold text-sm hover:bg-cherryMid transition-colors disabled:opacity-40"
          >
            {mudandoPausa ? "Voltando..." : "Voltei: devolver para pronta entrega"}
          </button>
        </div>
      ) : (
        <button
          onClick={() => {
            const certeza = window.confirm(
              "Todo doce que está em pronta entrega vai passar a pedir 1 dia de preparo.\n\nQuem já é encomenda não muda. Depois é só apertar “Voltei” para desfazer."
            );
            if (certeza) alternarPausa(true);
          }}
          disabled={mudandoPausa || carregando}
          className="mt-4 w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/70 border border-cherryLight/60 text-cherryDark rounded-full px-5 min-h-[44px] font-body text-sm hover:border-cherryDark transition-colors disabled:opacity-40"
        >
          🚪 {mudandoPausa ? "Mudando..." : "Vou sair: tudo vira encomenda de 1 dia"}
        </button>
      )}

      {/* Busca e filtros: ficam grudados no topo pra continuarem à mão
          enquanto ela rola a lista. */}
      <div className="sticky top-0 z-10 -mx-4 px-4 sm:mx-0 sm:px-0 pt-3 pb-2 bg-cream/95 backdrop-blur-sm grid gap-2">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, recheio, sabor ou categoria..."
          className="w-full border border-cherryLight/50 rounded-xl px-4 py-2.5 bg-white/80 font-body text-sm focus:outline-none focus:ring-2 focus:ring-cherryDark"
        />

        <div className="flex gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible pb-1">
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            aria-label="Filtrar por categoria"
            className="shrink-0 text-sm font-body border border-cherryLight/40 rounded-full px-3 py-2 bg-white/80"
          >
            <option value="todas">Todas as categorias</option>
            {categoriasParaFiltrar.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={estoque}
            onChange={(e) => setEstoque(e.target.value as FiltroEstoque)}
            aria-label="Filtrar por estoque"
            className="shrink-0 text-sm font-body border border-cherryLight/40 rounded-full px-3 py-2 bg-white/80"
          >
            <option value="todos">Com e sem estoque</option>
            <option value="disponivel">Só os disponíveis</option>
            <option value="esgotado">Só os esgotados</option>
          </select>

          <select
            value={ordem}
            onChange={(e) => setOrdem(e.target.value as Ordem)}
            aria-label="Ordenar"
            className="shrink-0 text-sm font-body border border-cherryLight/40 rounded-full px-3 py-2 bg-white/80"
          >
            <option value="recentes">Mais recentes</option>
            <option value="antigos">Mais antigos</option>
            <option value="nome">Nome (A–Z)</option>
            <option value="preco">Preço</option>
          </select>
        </div>
      </div>

      {carregando && <p className="font-body text-ink/60 mt-4">Carregando...</p>}

      {!carregando && visiveis.length === 0 && (
        <p className="font-body text-ink/60 mt-6">
          {produtos.length === 0
            ? "Nenhum doce cadastrado ainda. Comece adicionando o primeiro! 🍒"
            : "Nenhum doce com esses filtros. Tente outra busca."}
        </p>
      )}

      <div className="grid gap-3 mt-3">
        {visiveis.map((produto) => {
          const aberto = abertos.includes(produto.id);
          const situacao = situacaoDoEstoque(produto);
          const capa = fotosDoProduto(produto)[0];

          return (
            <div
              key={produto.id}
              className={`bg-white/70 border rounded-2xl overflow-hidden ${
                produto.ativo ? "border-cherryLight/30" : "border-ink/15 bg-ink/5"
              }`}
            >
              {/* Linha compacta: o que ela precisa ver sem abrir nada */}
              <button
                onClick={() => alternar(produto.id)}
                aria-expanded={aberto}
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-blush/30 transition-colors"
              >
                <span className="w-14 h-14 shrink-0 rounded-xl overflow-hidden bg-blush flex items-center justify-center text-xl">
                  {capa ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={capa} alt="" className="w-full h-full object-cover" />
                  ) : (
                    "🍰"
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-display text-base text-cherryDark truncate">
                      {produto.nome || "(sem nome)"}
                    </span>
                    {!produto.ativo && (
                      <span className="text-[11px] font-body bg-ink/15 text-ink/60 rounded-full px-2 py-0.5">
                        fora do cardápio
                      </span>
                    )}
                    {situacao === "esgotado" && (
                      <span className="text-[11px] font-body bg-cherryDark text-white rounded-full px-2 py-0.5">
                        esgotado
                      </span>
                    )}
                  </span>
                  <span className="block text-xs font-body text-ink/55 mt-0.5 truncate">
                    {categoriaDoProduto(produto)} · {resumoDePreco(produto)} ·{" "}
                    {resumoDeEstoqueTexto(produto)}
                    {temRecheios(produto) &&
                      ` · ${produto.sabores!.length} recheio${produto.sabores!.length > 1 ? "s" : ""}`}
                  </span>
                </span>

                <span className="shrink-0 text-cherryDark font-body text-sm px-2">
                  {aberto ? "fechar ▲" : "editar ▼"}
                </span>
              </button>

              {aberto && (
                <div className="p-3 sm:p-4 pt-0 grid gap-2 border-t border-cherryLight/25">
                  <input
                    value={produto.nome}
                    onChange={(e) => handleCampo(produto.id, "nome", e.target.value)}
                    placeholder="Nome do doce"
                    className="w-full font-display text-lg bg-transparent border-b border-cherryLight/40 focus:outline-none py-1 mt-3"
                  />
                  <textarea
                    value={produto.descricao}
                    onChange={(e) => handleCampo(produto.id, "descricao", e.target.value)}
                    rows={3}
                    className="w-full text-sm font-body bg-transparent border border-cherryLight/30 rounded-lg p-2"
                  />

                  {/* Categoria: escolhida entre as que ela criou, pra não
                      nascerem "Tortas" e "torta" como coisas diferentes. */}
                  <label className="grid gap-0.5">
                    <span className="text-xs text-ink/50">
                      Categoria (o cardápio agrupa por ela)
                    </span>
                    <select
                      value={produto.categoria ?? ""}
                      onChange={(e) => handleCampo(produto.id, "categoria", e.target.value)}
                      className="w-full text-sm font-body border border-cherryLight/30 rounded-lg p-2 bg-white/70"
                    >
                      <option value="">Sem categoria</option>
                      {categorias.map((c) => (
                        <option key={c.id} value={c.nome}>
                          {c.nome}
                        </option>
                      ))}
                      {/* Categoria antiga que não existe mais na lista: fica
                          visível pra ela ver o que está gravado hoje. */}
                      {produto.categoria &&
                        !categorias.some((c) => c.nome === produto.categoria) && (
                          <option value={produto.categoria}>
                            {produto.categoria} (removida)
                          </option>
                        )}
                    </select>
                    <Link
                      href="/admin/categorias"
                      className="text-xs text-cherryDark underline justify-self-start py-1"
                    >
                      Criar ou organizar categorias
                    </Link>
                  </label>

                  {/*
                    Doce COM recheios não tem preço, custo nem estoque próprios
                    — quem manda são os recheios, e mostrar nos dois lugares só
                    criaria dúvida sobre qual vale.
                  */}
                  {temRecheios(produto) ? (
                    <p className="text-xs font-body text-ink/60 bg-blush/40 border border-cherryLight/30 rounded-lg px-3 py-2">
                      Preço, custo e estoque deste doce ficam em cada recheio,
                      logo abaixo. 🍒
                    </p>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          value={produto.sabor}
                          onChange={(e) => handleCampo(produto.id, "sabor", e.target.value)}
                          placeholder="Sabor"
                          className="w-full text-sm font-body bg-transparent border border-cherryLight/30 rounded-lg p-2"
                        />
                        <label className="grid gap-0.5">
                          <span className="text-xs text-ink/50">Preço de venda (R$)</span>
                          <CampoNumero
                            valor={produto.preco}
                            onChange={(v) => handleCampo(produto.id, "preco", v ?? 0)}
                            className="w-full text-sm font-body bg-transparent border border-cherryLight/30 rounded-lg p-2"
                          />
                        </label>
                        {/* Sem o custo não dá pra calcular lucro nas métricas. */}
                        <label className="grid gap-0.5">
                          <span className="text-xs text-ink/50">Custo de produção (R$)</span>
                          <CampoNumero
                            valor={produto.custo ?? 0}
                            onChange={(v) => handleCampo(produto.id, "custo", v ?? 0)}
                            className={`w-full text-sm font-body bg-transparent border rounded-lg p-2 ${
                              (produto.custo ?? 0) <= 0
                                ? "border-amber-300 bg-amber-50/50"
                                : "border-cherryLight/30"
                            }`}
                          />
                        </label>
                      </div>

                      <CampoPromocao
                        preco={produto.preco}
                        promocional={produto.precoPromocional ?? null}
                        onChange={(v) => handleCampo(produto.id, "precoPromocional", v)}
                      />

                      <SobraPorUnidade
                        preco={produto.preco}
                        custo={produto.custo ?? 0}
                      />

                      {/* Estoque: vazio = não controla; zero = esgotado. */}
                      <label className="grid gap-0.5">
                        <span className="text-xs text-ink/50">
                          Estoque — quantas unidades você tem
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          <CampoNumero
                            valor={produto.estoque ?? null}
                            onChange={(v) =>
                              handleCampo(
                                produto.id,
                                "estoque",
                                v == null ? null : Math.round(v)
                              )
                            }
                            casas={0}
                            placeholder="deixe vazio para não controlar"
                            className={`w-full sm:w-64 text-sm font-body bg-transparent border rounded-lg p-2 ${
                              produto.estoque === 0
                                ? "border-cherryDark bg-cherryDark/5"
                                : "border-cherryLight/30"
                            }`}
                          />
                          <span className="text-xs font-body">
                            {produto.estoque == null ? (
                              <span className="text-ink/45">sempre disponível</span>
                            ) : produto.estoque === 0 ? (
                              <span className="text-cherryDark font-semibold">
                                ESGOTADO no cardápio
                              </span>
                            ) : (
                              <span className="text-green-700">
                                {produto.estoque}{" "}
                                {produto.estoque === 1
                                  ? "unidade à venda"
                                  : "unidades à venda"}
                              </span>
                            )}
                          </span>
                        </div>
                      </label>
                    </>
                  )}

                  <GaleriaFotos
                    fotos={fotosDoProduto(produto)}
                    onChange={(fotos) => trocarFotos(produto.id, fotos)}
                  />

                  <EditorSabores
                    produto={produto}
                    sabores={produto.sabores ?? []}
                    onChange={(sabores) => handleCampo(produto.id, "sabores", sabores)}
                  />

                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 border-t border-cherryLight/25 pt-3">
                    <select
                      value={produto.disponibilidade}
                      onChange={(e) =>
                        handleCampo(produto.id, "disponibilidade", e.target.value)
                      }
                      className="text-sm font-body border border-cherryLight/30 rounded-lg p-2 bg-white/70"
                    >
                      <option value="pronta_entrega">Pronta entrega</option>
                      <option value="sob_encomenda">Sob encomenda</option>
                    </select>
                    {produto.disponibilidade === "sob_encomenda" && (
                      <CampoNumero
                        valor={produto.prazoDias ?? 0}
                        onChange={(v) =>
                          handleCampo(produto.id, "prazoDias", Math.round(v ?? 0))
                        }
                        casas={0}
                        placeholder="Prazo (dias)"
                        aria-label="Prazo em dias"
                        className="text-sm font-body border border-cherryLight/30 rounded-lg p-2 w-24"
                      />
                    )}
                    <label className="text-sm font-body flex items-center gap-2 py-1 sm:ml-auto">
                      <input
                        type="checkbox"
                        checked={produto.ativo}
                        onChange={(e) => handleCampo(produto.id, "ativo", e.target.checked)}
                        className="w-5 h-5 accent-cherryDark"
                      />
                      Ativo no cardápio
                    </label>
                  </div>

                  <div className="flex gap-2 justify-end items-center">
                    <button
                      onClick={() => remover(produto.id)}
                      className="text-sm text-red-600 font-body px-3 py-3 rounded-lg hover:bg-red-50"
                    >
                      Remover
                    </button>
                    <button
                      onClick={() => salvar(produto)}
                      disabled={salvandoId === produto.id}
                      className="text-sm bg-cherryDark text-white rounded-full px-5 py-2.5 font-body font-semibold disabled:opacity-50"
                    >
                      {salvandoId === produto.id ? "Salvando..." : "Salvar"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <AvisoSalvo aviso={aviso} />
    </main>
  );
}
