"use client";

import { useRef, useState } from "react";
import CampoNumero from "./CampoNumero";
import SobraPorUnidade from "./SobraPorUnidade";
import { enviarFotoProduto } from "@/lib/api";
import { reais } from "@/lib/formato";
import type { Produto, SaborDoDoce } from "@/lib/types";

/**
 * Os recheios de um doce, no painel.
 *
 * Existe pra Camily não precisar cadastrar "Torta de Nutella", "Torta de
 * Ninho" e "Torta de Brigadeiro" como três doces diferentes — é um doce só,
 * com os recheios dentro, cada um com sua foto.
 *
 * Preço em branco quer dizer "cobra o preço do doce", e estoque em branco
 * quer dizer "não controlo este recheio". Os dois são o caso mais comum, por
 * isso ficam vazios por padrão.
 */
export default function EditorSabores({
  produto,
  sabores,
  onChange,
}: {
  produto: Pick<Produto, "preco">;
  sabores: SaborDoDoce[];
  onChange: (sabores: SaborDoDoce[]) => void;
}) {
  const [enviandoFoto, setEnviandoFoto] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  // Um input de arquivo por sabor, pra saber de quem é a foto escolhida.
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  function adicionar() {
    onChange([
      ...sabores,
      {
        id: crypto.randomUUID(),
        produtoId: "",
        nome: "",
        fotoUrl: "",
        preco: null,
        estoque: null,
        ordem: sabores.length,
        ativo: true,
      },
    ]);
  }

  function mudar(id: string, campo: keyof SaborDoDoce, valor: unknown) {
    onChange(sabores.map((s) => (s.id === id ? { ...s, [campo]: valor } : s)));
  }

  function remover(id: string) {
    onChange(sabores.filter((s) => s.id !== id));
  }

  function mover(id: string, direcao: -1 | 1) {
    const i = sabores.findIndex((s) => s.id === id);
    const j = i + direcao;
    if (i < 0 || j < 0 || j >= sabores.length) return;
    const novos = [...sabores];
    [novos[i], novos[j]] = [novos[j], novos[i]];
    onChange(novos.map((s, ordem) => ({ ...s, ordem })));
  }

  async function escolherFoto(id: string, e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setErro("");
    setEnviandoFoto(id);
    try {
      mudar(id, "fotoUrl", await enviarFotoProduto(arquivo));
    } catch (erro) {
      setErro(erro instanceof Error ? erro.message : "Não foi possível enviar a foto.");
    } finally {
      setEnviandoFoto(null);
      const input = inputs.current[id];
      if (input) input.value = "";
    }
  }

  return (
    <div className="grid gap-2 border-t border-cherryLight/25 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-body text-ink/80">
          Recheios deste doce{" "}
          <span className="text-ink/45">
            {sabores.length > 0 ? `(${sabores.length})` : "(nenhum)"}
          </span>
        </span>
        <button
          type="button"
          onClick={adicionar}
          className="text-sm font-body text-cherryDark border border-cherryLight/50 rounded-full px-4 py-2.5 hover:bg-blush"
        >
          + Adicionar recheio
        </button>
      </div>

      {sabores.length === 0 ? (
        <p className="text-xs font-body text-ink/50">
          Sem recheios, este doce é vendido de um jeito só. Adicione um recheio
          quando o mesmo doce tiver versões — a cliente escolhe pela foto no
          cardápio.
        </p>
      ) : (
        <div className="grid gap-2">
          {sabores.map((sabor, i) => (
            <div
              key={sabor.id}
              className="border border-cherryLight/30 rounded-xl p-2.5 grid gap-2 bg-white/50"
            >
              <div className="flex gap-2.5">
                {/* Foto do recheio */}
                <button
                  type="button"
                  onClick={() => inputs.current[sabor.id]?.click()}
                  disabled={enviandoFoto === sabor.id}
                  className="w-20 h-20 shrink-0 rounded-xl bg-blush border border-cherryLight/40 overflow-hidden flex items-center justify-center text-2xl disabled:opacity-50"
                  aria-label={`Foto do recheio ${sabor.nome || i + 1}`}
                >
                  {enviandoFoto === sabor.id ? (
                    <span className="text-[10px] font-body text-cherryDark px-1">
                      enviando...
                    </span>
                  ) : sabor.fotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sabor.fotoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] font-body text-cherryDark px-1 text-center">
                      escolher foto
                    </span>
                  )}
                </button>
                <input
                  ref={(el) => {
                    inputs.current[sabor.id] = el;
                  }}
                  type="file"
                  accept="image/*"
                  onChange={(e) => escolherFoto(sabor.id, e)}
                  className="hidden"
                />

                <div className="grid gap-2 flex-1 min-w-0">
                  <input
                    value={sabor.nome}
                    onChange={(e) => mudar(sabor.id, "nome", e.target.value)}
                    placeholder="Nome do recheio (ex: Nutella)"
                    className="w-full text-sm font-body bg-transparent border border-cherryLight/30 rounded-lg p-2"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <label className="grid gap-0.5">
                      <span className="text-[11px] text-ink/50">Preço de venda (R$)</span>
                      <CampoNumero
                        valor={sabor.preco ?? null}
                        onChange={(v) => mudar(sabor.id, "preco", v)}
                        placeholder={produto.preco ? reais(produto.preco) : "0,00"}
                        className={`w-full text-sm font-body bg-transparent border rounded-lg p-2 ${
                          sabor.preco == null
                            ? "border-amber-300 bg-amber-50/50"
                            : "border-cherryLight/30"
                        }`}
                      />
                    </label>
                    <label className="grid gap-0.5">
                      <span className="text-[11px] text-ink/50">Custo de produção (R$)</span>
                      <CampoNumero
                        valor={sabor.custo ?? 0}
                        onChange={(v) => mudar(sabor.id, "custo", v ?? 0)}
                        className={`w-full text-sm font-body bg-transparent border rounded-lg p-2 ${
                          (sabor.custo ?? 0) <= 0
                            ? "border-amber-300 bg-amber-50/50"
                            : "border-cherryLight/30"
                        }`}
                      />
                    </label>
                    <label className="grid gap-0.5">
                      <span className="text-[11px] text-ink/50">Estoque</span>
                      <CampoNumero
                        valor={sabor.estoque ?? null}
                        onChange={(v) =>
                          mudar(sabor.id, "estoque", v == null ? null : Math.round(v))
                        }
                        casas={0}
                        placeholder="vazio = sem controle"
                        className={`w-full text-sm font-body bg-transparent border rounded-lg p-2 ${
                          sabor.estoque === 0
                            ? "border-cherryDark bg-cherryDark/5"
                            : "border-cherryLight/30"
                        }`}
                      />
                    </label>
                  </div>

                  {/* Cada recheio tem preço e custo próprios, então a conta
                      do que sobra também é de cada um. */}
                  <SobraPorUnidade
                    preco={sabor.preco ?? produto.preco}
                    custo={sabor.custo ?? 0}
                  />
                </div>
              </div>

              {/* Disponibilidade do recheio: um pode estar pronto na
                  geladeira e outro sair só por encomenda. */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={sabor.disponibilidade ?? "herda"}
                  onChange={(e) =>
                    mudar(
                      sabor.id,
                      "disponibilidade",
                      e.target.value === "herda" ? null : e.target.value
                    )
                  }
                  className="text-sm font-body border border-cherryLight/30 rounded-lg p-2 bg-white/70"
                >
                  <option value="herda">Igual ao doce</option>
                  <option value="pronta_entrega">Pronta entrega</option>
                  <option value="sob_encomenda">Sob encomenda</option>
                </select>

                {sabor.disponibilidade === "sob_encomenda" && (
                  <label className="flex items-center gap-1.5 text-xs font-body text-ink/60">
                    Prazo
                    <CampoNumero
                      valor={sabor.prazoDias ?? null}
                      onChange={(v) =>
                        mudar(sabor.id, "prazoDias", v == null ? null : Math.round(v))
                      }
                      casas={0}
                      placeholder="dias"
                      aria-label="Prazo em dias deste recheio"
                      className="w-20 text-sm font-body border border-cherryLight/30 rounded-lg p-2 bg-transparent"
                    />
                    dias
                  </label>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs font-body">
                {sabor.estoque === 0 && (
                  <span className="text-cherryDark font-semibold">
                    ESGOTADO no cardápio
                  </span>
                )}
                {sabor.preco == null && (
                  <span className="text-amber-700">
                    sem preço — vai cobrar {reais(produto.preco)}
                  </span>
                )}
                <label className="flex items-center gap-1.5 text-ink/70">
                  <input
                    type="checkbox"
                    checked={sabor.ativo}
                    onChange={(e) => mudar(sabor.id, "ativo", e.target.checked)}
                    className="w-5 h-5 accent-cherryDark"
                  />
                  aparece no cardápio
                </label>

                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => mover(sabor.id, -1)}
                    disabled={i === 0}
                    aria-label="Subir este recheio"
                    className="w-11 h-11 rounded-lg text-cherryDark disabled:opacity-25"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => mover(sabor.id, 1)}
                    disabled={i === sabores.length - 1}
                    aria-label="Descer este recheio"
                    className="w-11 h-11 rounded-lg text-cherryDark disabled:opacity-25"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => remover(sabor.id)}
                    className="text-red-600 px-3 py-3 rounded-lg hover:bg-red-50"
                  >
                    Remover
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {erro && <span className="text-xs text-cherryDark">{erro}</span>}
    </div>
  );
}
