"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import { fotosDoProduto } from "@/lib/fotos";
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

  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const [estoque, setEstoque] = useState<FiltroEstoque>("todos");
  const [ordem, setOrdem] = useState<Ordem>("recentes");
  /** As categorias criadas em /admin/categorias, pra escolher em cada doce. */
  const [categorias, setCategorias] = useState<CategoriaDoPainel[]>([]);

  useEffect(() => {
    getProdutos()
      .then(setProdutos)
      .catch(() => setProdutos([]))
      .finally(() => setCarregando(false));
    getCategorias()
      .then(setCategorias)
      .catch(() => setCategorias([]));
  }, []);

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

  async function salvar(produto: Produto) {
    setSalvandoId(produto.id);
    try {
      await upsertProduto(produto);
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

    </main>
  );
}
