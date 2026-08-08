"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import VoltarAoPainel from "@/components/VoltarAoPainel";

type Resumo = {
  pedidos: number;
  faturamento: number;
  lucro: number;
  cancelados: number;
  ticketMedio: number;
};

type Metricas = {
  periodo: { nome: string; rotulo: string; rotuloAnterior: string };
  atual: Resumo;
  anterior: Resumo | null;
  variacao: Record<keyof Resumo, number | null> | null;
  clientes: { total: number; novos: number };
  topProdutos: { produtoId: string; nome: string; quantidade: number; total: number }[];
  produtosSemCusto: number;
};

const PERIODOS = [
  { valor: "hoje", label: "Hoje" },
  { valor: "semana", label: "Esta semana" },
  { valor: "mes", label: "Este mês" },
  { valor: "trimestre", label: "3 meses" },
  { valor: "tudo", label: "Desde o início" },
];

const dinheiro = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function AdminMetricasPage() {
  const [periodo, setPeriodo] = useState("mes");
  const [dados, setDados] = useState<Metricas | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setCarregando(true);
    fetch(`/api/metricas?periodo=${periodo}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setDados)
      .catch(() => setDados(null))
      .finally(() => setCarregando(false));
  }, [periodo]);

  return (
    <main className="min-h-screen px-4 sm:px-6 md:px-12 py-8 md:py-10 max-w-3xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl sm:text-3xl text-cherryDark">
          Meus números
        </h1>
        <VoltarAoPainel />
      </div>

      <div className="flex gap-2 mt-4 overflow-x-auto sm:flex-wrap sm:overflow-visible pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
        {PERIODOS.map((p) => (
          <button
            key={p.valor}
            onClick={() => setPeriodo(p.valor)}
            className={`shrink-0 px-4 py-2.5 rounded-full text-sm font-body border transition-colors ${
              periodo === p.valor
                ? "bg-cherryDark text-white border-cherryDark"
                : "bg-white/70 text-ink/70 border-cherryLight/50 hover:border-cherryDark"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {carregando && <p className="text-ink/60 font-body mt-6">Calculando...</p>}

      {!carregando && dados && (
        <>
          {dados.produtosSemCusto > 0 && (
            <p className="mt-4 text-sm font-body bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-3">
              {dados.produtosSemCusto}{" "}
              {dados.produtosSemCusto === 1
                ? "doce ainda está sem custo cadastrado"
                : "doces ainda estão sem custo cadastrado"}
              , então o lucro está incompleto.{" "}
              <Link href="/admin/produtos" className="underline font-semibold">
                Cadastrar agora
              </Link>
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 mt-5">
            <Cartao
              titulo="Pedidos"
              valor={String(dados.atual.pedidos)}
              variacao={dados.variacao?.pedidos}
              comparado={dados.periodo.rotuloAnterior}
            />
            <Cartao
              titulo="Faturamento"
              valor={dinheiro(dados.atual.faturamento)}
              variacao={dados.variacao?.faturamento}
              comparado={dados.periodo.rotuloAnterior}
            />
            <Cartao
              titulo="Lucro"
              valor={dinheiro(dados.atual.lucro)}
              variacao={dados.variacao?.lucro}
              comparado={dados.periodo.rotuloAnterior}
            />
            <Cartao
              titulo="Ticket médio"
              valor={dinheiro(dados.atual.ticketMedio)}
              variacao={dados.variacao?.ticketMedio}
              comparado={dados.periodo.rotuloAnterior}
            />
            <Cartao
              titulo="Cancelados"
              valor={String(dados.atual.cancelados)}
              variacao={dados.variacao?.cancelados}
              comparado={dados.periodo.rotuloAnterior}
              /* Cancelamento subindo é notícia ruim: inverte as cores. */
              inverterCores
            />
            <Cartao
              titulo="Clientes"
              valor={String(dados.clientes.total)}
              rodape={`${dados.clientes.novos} ${dados.clientes.novos === 1 ? "novo" : "novos"} ${dados.periodo.rotulo}`}
            />
          </div>

          <h2 className="font-display text-xl text-cherryDark mt-8">
            Doces mais vendidos
          </h2>
          <p className="text-sm font-body text-ink/60 mb-3">{dados.periodo.rotulo}</p>

          {dados.topProdutos.length === 0 ? (
            <p className="text-ink/60 font-body">
              Nenhuma venda neste período ainda.
            </p>
          ) : (
            <ol className="grid gap-2">
              {dados.topProdutos.map((p, i) => (
                <li
                  key={p.produtoId}
                  /* min-w-0 no próprio item: dentro de um grid ele nasce com
                     min-width auto e se recusa a encolher, então em tela de
                     320px o nome do doce empurrava o valor pra fora. */
                  className="min-w-0 flex items-center gap-2 sm:gap-3 bg-white/70 border border-cherryLight/30 rounded-xl px-3 py-2.5 font-body text-sm"
                >
                  <span
                    className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                      i === 0
                        ? "bg-cherryDark text-white"
                        : "bg-blush text-cherryDark"
                    }`}
                  >
                    {i + 1}
                  </span>
                  {/* min-w-0 no bloco de texto: sem isso o nome longo empurra
                      os valores pra fora da tela em celular pequeno. */}
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-ink/80">{p.nome}</span>
                    <span className="block text-xs text-ink/50">
                      {p.quantidade} un
                    </span>
                  </span>
                  <span className="font-display text-cherryDark shrink-0">
                    {dinheiro(p.total)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </main>
  );
}

/**
 * Cartão de um número, com a comparação embaixo. Verde quando melhorou,
 * vermelho quando piorou — e sem cor quando não há base de comparação.
 */
function Cartao({
  titulo,
  valor,
  variacao,
  comparado,
  rodape,
  inverterCores,
}: {
  titulo: string;
  valor: string;
  variacao?: number | null;
  comparado?: string;
  rodape?: string;
  inverterCores?: boolean;
}) {
  const subiu = variacao != null && variacao > 0;
  const caiu = variacao != null && variacao < 0;
  const bom = inverterCores ? caiu : subiu;
  const ruim = inverterCores ? subiu : caiu;

  return (
    <div className="bg-white/70 border border-cherryLight/30 rounded-2xl p-4">
      <p className="text-xs font-body text-ink/55">{titulo}</p>
      <p className="font-display text-xl sm:text-2xl text-cherryDark mt-1 break-words">
        {valor}
      </p>

      {variacao != null && variacao !== 0 && (
        <p
          className={`text-xs font-body mt-1.5 font-semibold ${
            bom ? "text-green-700" : ruim ? "text-cherryDark" : "text-ink/50"
          }`}
        >
          {subiu ? "▲" : "▼"} {Math.abs(variacao).toFixed(0)}%
          <span className="font-normal text-ink/45"> vs {comparado}</span>
        </p>
      )}
      {variacao === 0 && (
        <p className="text-xs font-body mt-1.5 text-ink/45">
          igual a {comparado}
        </p>
      )}
      {variacao == null && comparado && (
        <p className="text-xs font-body mt-1.5 text-ink/40">
          sem {comparado} pra comparar
        </p>
      )}
      {rodape && <p className="text-xs font-body mt-1.5 text-ink/50">{rodape}</p>}
    </div>
  );
}
