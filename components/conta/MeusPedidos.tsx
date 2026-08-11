"use client";

import { useEffect, useState } from "react";
import Estrelas from "@/components/Estrelas";
import {
  avaliarDoce,
  cancelarMeuPedido,
  enviarStory,
  getMeusPedidos,
  getMeusStories,
} from "@/lib/api";
import { reais } from "@/lib/formato";
import { SITUACAO_PARA_CLIENTE, textoDoReembolso } from "@/lib/status-pedido";
import type { PedidoDoCliente, StoryEnviado } from "@/lib/types";

/**
 * Histórico de compras do cliente. Daqui ele faz as duas coisas que antes só
 * dava pra resolver no WhatsApp: cancelar um pedido que ainda não entrou em
 * produção e dar nota nos doces que já recebeu.
 */
export default function MeusPedidos() {
  const [pedidos, setPedidos] = useState<PedidoDoCliente[]>([]);
  const [stories, setStories] = useState<StoryEnviado[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    Promise.all([
      getMeusPedidos().catch(() => []),
      getMeusStories().catch(() => []),
    ])
      .then(([p, s]) => {
        setPedidos(p);
        setStories(s);
      })
      .finally(() => setCarregando(false));
  }, []);

  function recarregar() {
    getMeusPedidos().then(setPedidos).catch(() => {});
    getMeusStories().then(setStories).catch(() => {});
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
        <CartaoPedido
          key={p.id}
          pedido={p}
          story={stories.find((s) => s.pedidoId === p.id) ?? null}
          onMudou={recarregar}
        />
      ))}
    </div>
  );
}

function CartaoPedido({
  pedido,
  story,
  onMudou,
}: {
  pedido: PedidoDoCliente;
  story: StoryEnviado | null;
  onMudou: () => void;
}) {
  const [cancelando, setCancelando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [pagando, setPagando] = useState(false);
  const [erro, setErro] = useState("");

  const situacao = SITUACAO_PARA_CLIENTE[pedido.status];
  const subtotal = pedido.itens.reduce((a, i) => a + i.precoUnitario * i.quantidade, 0);
  const total = subtotal - pedido.desconto + pedido.valorFrete;
  const reembolso = textoDoReembolso(pedido.statusReembolso);

  /**
   * Volta para a tela de pagamento deste pedido.
   *
   * Quem fecha o Mercado Pago no meio ficava sem saída: o pedido existia,
   * mas não havia botão nenhum para concluir. O servidor reabre a MESMA
   * cobrança, com os valores já gravados — nada é recalculado.
   */
  async function pagarAgora() {
    setErro("");
    setPagando(true);
    try {
      const r = await fetch(`/api/cliente/pedidos/${pedido.id}/pagar`, {
        method: "POST",
      });
      const corpo = await r.json();
      if (!r.ok || !corpo.url) {
        setErro(corpo.error ?? "Não consegui abrir o pagamento agora. Tenta de novo?");
        return;
      }
      window.location.href = corpo.url;
    } catch {
      setErro("Não consegui abrir o pagamento agora. Confere a internet e tenta de novo?");
    } finally {
      setPagando(false);
    }
  }

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
    <div className="bg-white/70 border border-cherryLight/30 rounded-2xl p-4 grid gap-3 font-body text-sm">
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

      {/* Onde buscar, pra cliente não precisar caçar no e-mail. */}
      {pedido.pontoRetirada && (
        <p className="text-xs bg-white/80 border border-cherryLight/40 rounded-xl px-3 py-2 text-ink/75">
          📍 <strong>Você busca em:</strong> {pedido.pontoRetirada}
          <span className="block text-ink/55 mt-0.5">
            O horário você combina com a Camily pelo WhatsApp.
          </span>
        </p>
      )}

      {pedido.ehPresente && (
        <p className="text-xs bg-blush/60 border border-cherryLight/40 rounded-xl px-3 py-2 text-ink/70">
          🎁 Presente{pedido.nomeQuemRecebe ? ` para ${pedido.nomeQuemRecebe}` : ""}
          {pedido.bilhete && " · com bilhete"}
        </p>
      )}

      {reembolso && (
        <p className="text-xs bg-blush/60 border border-cherryLight/30 rounded-xl px-3 py-2 text-ink/70">
          {reembolso}
        </p>
      )}

      <ul className="text-ink/80 border-t border-cherryLight/20 pt-2 grid gap-1">
        {pedido.itens.map((i) => (
          <li
            key={`${i.produtoId}-${i.saborId ?? ""}`}
            className="flex justify-between gap-2"
          >
            <span>
              {i.quantidade}× {i.nome}
              {i.saborNome && <span className="text-cherryMid"> · {i.saborNome}</span>}
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
        {/* Linha própria: o abatimento do Pix não é cupom, e juntar os dois
            faria parecer que o cupom valeu mais do que valeu. */}
        {(pedido.descontoPix ?? 0) > 0 && (
          <li className="flex justify-between gap-2 text-green-700">
            <span>Desconto pagando no Pix</span>
            <span>-{reais(pedido.descontoPix)}</span>
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
          {/* A nota é do doce, não do recheio: quem levou dois recheios da
              mesma torta avalia a torta uma vez só. */}
          {[...new Map(pedido.itens.map((i) => [i.produtoId, i])).values()].map((i) => (
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

      {/* Postou nos stories? Manda o print e a Camily libera os pontos. */}
      {pedido.podeAvaliar && (
        <EnviarStory pedidoId={pedido.id} story={story} onEnviou={onMudou} />
      )}

      {/* Pedido parado esperando pagamento: o caminho de volta pra concluir.
          Vem antes do "cancelar" porque é o que ela quer fazer. */}
      {pedido.status === "aguardando_pagamento" && (
        <button
          onClick={pagarAgora}
          disabled={pagando}
          className="bg-cherryDark text-white rounded-full px-5 py-3 font-semibold hover:bg-cherryMid active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {pagando ? "Abrindo o pagamento..." : `Pagar agora · ${reais(total)}`}
        </button>
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

/**
 * "Postei nos stories": a cliente manda o print e espera a Camily aprovar.
 *
 * O print existe porque o Instagram não deixa o site descobrir sozinho quem
 * postou (a API só enxerga perfil público que marque com @). Assim vale pra
 * todo mundo, e a Camily ainda vê o story pra repostar.
 */
function EnviarStory({
  pedidoId,
  story,
  onEnviou,
}: {
  pedidoId: string;
  story: StoryEnviado | null;
  onEnviou: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [arroba, setArroba] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  if (story) {
    const cor =
      story.situacao === "aprovado"
        ? "text-green-700 bg-green-50 border-green-200"
        : story.situacao === "recusado"
          ? "text-cherryDark bg-blush/60 border-cherryLight/50"
          : "text-ink/70 bg-white/70 border-cherryLight/30";
    return (
      <p className={`text-xs border rounded-xl px-3 py-2 ${cor}`}>
        {story.situacao === "aprovado" &&
          `Story aprovado! Você ganhou ${story.pontosCreditados} ${story.pontosCreditados === 1 ? "ponto" : "pontos"}. 🍒`}
        {story.situacao === "pendente" &&
          "Story enviado! A Camily vai conferir e seus pontos entram logo."}
        {story.situacao === "recusado" &&
          `Não deu pra validar este story.${story.motivoRecusa ? ` ${story.motivoRecusa}` : " Fale com a Camily no WhatsApp."}`}
      </p>
    );
  }

  async function enviar() {
    if (!arquivo) {
      setErro("Escolha o print do seu story.");
      return;
    }
    setErro("");
    setEnviando(true);
    try {
      await enviarStory({ pedidoId, arroba, imagem: arquivo });
      onEnviou();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar.");
      setEnviando(false);
    }
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="border border-cherryDark text-cherryDark rounded-full px-5 py-2.5 font-semibold justify-self-start text-sm"
      >
        📸 Postei nos stories — quero meus pontos
      </button>
    );
  }

  return (
    <div className="border border-cherryLight/40 rounded-xl p-3 grid gap-2 bg-blush/30">
      <p className="text-xs text-ink/70">
        Poste o doce nos stories marcando <strong>@doceterapia_28</strong>, tire um
        print e mande aqui. A Camily confere e os pontos entram na sua conta.
      </p>

      <label className="grid gap-1 text-xs text-ink/70">
        Seu @ no Instagram (opcional)
        <input
          value={arroba}
          onChange={(e) => setArroba(e.target.value)}
          placeholder="@seuperfil"
          className="w-full border border-cherryLight/40 rounded-xl px-3 py-2.5 bg-white/70 text-sm"
        />
      </label>

      <label className="grid gap-1 text-xs text-ink/70">
        Print do story *
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
          className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-cherryDark file:text-white file:font-semibold"
        />
      </label>

      {erro && <p className="text-cherryDark text-xs">{erro}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={enviar}
          disabled={enviando}
          className="bg-cherryDark text-white rounded-full px-5 py-2.5 font-semibold disabled:opacity-50 text-sm"
        >
          {enviando ? "Enviando..." : "Enviar story"}
        </button>
        <button onClick={() => setAberto(false)} className="text-ink/60 px-4 py-2.5 text-sm">
          Agora não
        </button>
      </div>
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
