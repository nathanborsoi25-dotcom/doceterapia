"use client";

import { useEffect, useState } from "react";
import Estrelas from "@/components/Estrelas";
import { avaliarDoce, cancelarMeuPedido, getMeusPedidos } from "@/lib/api";
import { reais } from "@/lib/formato";
import { SITUACAO_PARA_CLIENTE, textoDoReembolso } from "@/lib/status-pedido";
import type { PedidoDoCliente } from "@/lib/types";

/**
 * Histórico de compras do cliente. Daqui ele faz as duas coisas que antes só
 * dava pra resolver no WhatsApp: cancelar um pedido que ainda não entrou em
 * produção e dar nota nos doces que já recebeu.
 */
export default function MeusPedidos() {
  const [pedidos, setPedidos] = useState<PedidoDoCliente[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    getMeusPedidos()
      .then(setPedidos)
      .catch(() => setPedidos([]))
      .finally(() => setCarregando(false));
  }, []);

  function recarregar() {
    getMeusPedidos().then(setPedidos).catch(() => {});
  }

  if (carregando) {
    return <p className="font-body text-ink/60 text-center py-8">Carregando seus pedidos...</p>;
  }

  if (pedidos.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-4xl">🍒</p>
        <p className="font-body text-ink/60 mt-3">
          Você ainda não fez nenhum pedido por aqui.
        </p>
        <a
          href="/catalogo"
          className="inline-block mt-4 bg-cherryDark text-white rounded-full px-6 py-3 font-body font-semibold"
        >
          Ver o cardápio
        </a>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {pedidos.map((p) => (
        <CartaoPedido key={p.id} pedido={p} onMudou={recarregar} />
      ))}
    </div>
  );
}

function CartaoPedido({
  pedido,
  onMudou,
}: {
  pedido: PedidoDoCliente;
  onMudou: () => void;
}) {
  const [cancelando, setCancelando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState("");

  const situacao = SITUACAO_PARA_CLIENTE[pedido.status];
  const subtotal = pedido.itens.reduce((a, i) => a + i.precoUnitario * i.quantidade, 0);
  const total = subtotal - pedido.desconto + pedido.valorFrete;
  const reembolso = textoDoReembolso(pedido.statusReembolso);

  async function cancelar() {
    setErro("");
    setCancelando(true);
    try {
      await cancelarMeuPedido(pedido.id, "");
      onMudou();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível cancelar.");
    } finally {
      setCancelando(false);
      setConfirmando(false);
    }
  }

  return (
    <div className="bg-white/70 border border-cherryLight/30 rounded-cherry p-4 grid gap-3 font-body text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${situacao.cor}`}>
          {situacao.rotulo}
        </span>
        <span className="font-display text-base text-cherryDark">{reais(total)}</span>
      </div>

      <p className="text-ink/60 text-xs">
        Pedido de {new Date(pedido.criadoEm).toLocaleDateString("pt-BR")} ·{" "}
        {pedido.tipoEntrega === "entrega" ? "Entrega" : "Retirada"}
        {pedido.dataAgendada &&
          ` · ${new Date(pedido.dataAgendada).toLocaleString("pt-BR", {
            dateStyle: "short",
            timeStyle: "short",
          })}`}
      </p>

      <p className="text-ink/70">{situacao.explicacao}</p>

      {reembolso && (
        <p className="text-xs bg-blush/60 border border-cherryLight/30 rounded-xl px-3 py-2 text-ink/70">
          {reembolso}
        </p>
      )}

      <ul className="text-ink/80 border-t border-cherryLight/20 pt-2 grid gap-1">
        {pedido.itens.map((i) => (
          <li key={i.produtoId} className="flex justify-between gap-2">
            <span>
              {i.quantidade}× {i.nome}
            </span>
            <span className="text-ink/60 shrink-0">
              {reais(i.precoUnitario * i.quantidade)}
            </span>
          </li>
        ))}
        {pedido.desconto > 0 && (
          <li className="flex justify-between gap-2 text-green-700">
            <span>Desconto {pedido.cupomCodigo && `(${pedido.cupomCodigo})`}</span>
            <span>-{reais(pedido.desconto)}</span>
          </li>
        )}
        {pedido.valorFrete > 0 && (
          <li className="flex justify-between gap-2 text-ink/60">
            <span>Entrega</span>
            <span>{reais(pedido.valorFrete)}</span>
          </li>
        )}
      </ul>

      {pedido.status === "a_caminho" && pedido.linkRastreio && (
        <a
          href={pedido.linkRastreio}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-cherryDark text-white rounded-full px-5 py-3 font-semibold text-center"
        >
          Acompanhar entrega
        </a>
      )}

      {/* Avaliar cada doce — só depois de receber, e uma vez por doce */}
      {pedido.podeAvaliar && (
        <div className="border-t border-cherryLight/20 pt-3 grid gap-3">
          <p className="text-xs text-ink/60">
            O que você achou? Sua nota ajuda outras pessoas a escolherem — e
            ainda rende pontos pra você.
          </p>
          {pedido.itens.map((i) => (
            <AvaliarDoce
              key={i.produtoId}
              pedidoId={pedido.id}
              produtoId={i.produtoId}
              nome={i.nome}
              jaAvaliado={pedido.avaliados.includes(i.produtoId)}
              onAvaliou={onMudou}
            />
          ))}
        </div>
      )}

      {erro && <p className="text-cherryDark text-sm">{erro}</p>}

      {pedido.podeCancelar && !confirmando && (
        <button
          onClick={() => setConfirmando(true)}
          className="text-cherryDark underline text-sm py-2 justify-self-start"
        >
          Cancelar este pedido
        </button>
      )}

      {pedido.podeCancelar && confirmando && (
        <div className="bg-blush/60 border border-cherryLight/40 rounded-xl p-3 grid gap-2">
          <p className="text-ink/80">
            Quer mesmo cancelar? {pedido.status === "pago"
              ? "Como o pagamento já foi confirmado, pedimos a devolução do valor na hora."
              : "Ainda não há pagamento concluído, então não há valor a devolver."}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={cancelar}
              disabled={cancelando}
              className="bg-cherryDark text-white rounded-full px-5 py-2.5 font-semibold disabled:opacity-50"
            >
              {cancelando ? "Cancelando..." : "Sim, cancelar"}
            </button>
            <button
              onClick={() => setConfirmando(false)}
              className="text-ink/60 px-4 py-2.5"
            >
              Voltar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Uma linha de avaliação: estrelas + comentário opcional, por doce. */
function AvaliarDoce({
  pedidoId,
  produtoId,
  nome,
  jaAvaliado,
  onAvaliou,
}: {
  pedidoId: string;
  produtoId: string;
  nome: string;
  jaAvaliado: boolean;
  onAvaliou: () => void;
}) {
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [pontos, setPontos] = useState<number | null>(null);

  if (jaAvaliado || pontos !== null) {
    return (
      <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
        Você já avaliou <strong>{nome}</strong>.
        {pontos ? ` Ganhou ${pontos} ${pontos === 1 ? "ponto" : "pontos"}! 🍒` : ""}
      </p>
    );
  }

  async function enviar() {
    if (nota < 1) {
      setErro("Escolha de 1 a 5 estrelas.");
      return;
    }
    setErro("");
    setEnviando(true);
    try {
      const r = await avaliarDoce({ pedidoId, produtoId, nota, comentario });
      setPontos(r.pontosGanhos);
      onAvaliou();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="border border-cherryLight/30 rounded-xl p-3 grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-ink/80 font-semibold">{nome}</span>
        <Estrelas nota={nota} onChange={setNota} tamanho="lg" />
      </div>
      {nota > 0 && (
        <>
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Quer contar o que achou? (opcional)"
            className="w-full border border-cherryLight/40 rounded-xl p-2.5 bg-white/70 text-sm"
          />
          {erro && <p className="text-cherryDark text-xs">{erro}</p>}
          <button
            onClick={enviar}
            disabled={enviando}
            className="bg-cherryDark text-white rounded-full px-5 py-2.5 font-semibold justify-self-start disabled:opacity-50"
          >
            {enviando ? "Enviando..." : "Enviar avaliação"}
          </button>
        </>
      )}
    </div>
  );
}
