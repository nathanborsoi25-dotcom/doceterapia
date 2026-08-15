"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { logoutAdmin } from "@/lib/api";
import ConviteInstalar from "@/components/ConviteInstalar";

const atalhos = [
  { href: "/admin/pedidos", label: "Meus pedidos", desc: "Ver e acompanhar os pedidos recebidos" },
  { href: "/admin/cardapio", label: "Ver meu site", desc: "Conferir o cardápio do jeito que a cliente vê" },
  { href: "/admin/metricas", label: "Meus números", desc: "Vendas, faturamento, lucro e mais vendidos" },
  { href: "/admin/avaliacoes", label: "Avaliações", desc: "O que os clientes acharam de cada doce" },
  { href: "/admin/stories", label: "Stories", desc: "Aprovar quem postou o doce e liberar os pontos" },
  { href: "/admin/promocoes", label: "Promoções", desc: "Cupons de desconto e destaque do cardápio" },
  { href: "/admin/fidelidade", label: "Fidelidade", desc: "Pontos por compra e prêmios para resgate" },
  { href: "/admin/produtos", label: "Meus produtos", desc: "Editar fotos, título, descrição e preço" },
  { href: "/admin/categorias", label: "Categorias", desc: "Criar e organizar as seções do cardápio" },
  { href: "/admin/produtos/novo", label: "Adicionar produto", desc: "Cadastrar um novo doce no cardápio" },
  { href: "/admin/frete", label: "Configurar frete", desc: "Faixas de distância e valores" },
  { href: "/admin/clientes", label: "Meus clientes", desc: "Quem já fez cadastro no site" },
  { href: "/admin/sobre", label: "Sobre mim", desc: "Sua foto, seu recado e seu WhatsApp no site" },
  { href: "/admin/politica", label: "Regras da loja", desc: "Cancelamento, entrega e pagamento em palavras suas" },
  { href: "/admin/retirada", label: "Onde o cliente busca", desc: "Endereços e horários de retirada" },
];

/** O que o painel precisa contar assim que ela abre. */
type Resumo = {
  pagos: number;
  emPreparo: number;
  aCaminho: number;
  canceladosRecentes: number;
  reembolsoFalhou: number;
  aguardandoPagamento: number;
  storiesPendentes: number;
  precisamDeAcao: number;
};

export default function AdminHome() {
  const router = useRouter();
  const [resumo, setResumo] = useState<Resumo | null>(null);

  useEffect(() => {
    fetch("/api/admin/resumo", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setResumo)
      .catch(() => setResumo(null));
  }, []);

  async function sair() {
    await logoutAdmin();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <main className="min-h-screen px-4 sm:px-6 md:px-12 py-8 md:py-10 max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-cherryDark">Painel Doceterapia</h1>
          <p className="text-ink/70 font-body mt-1">Só você vê essa área.</p>
        </div>
        <button
          onClick={sair}
          className="text-sm font-body text-cherryDark border border-cherryLight/50 rounded-full px-4 py-2.5 hover:bg-blush transition-colors shrink-0"
        >
          Sair
        </button>
      </div>

      {/*
        O que aconteceu desde a última vez que ela abriu.
        Vem ANTES dos atalhos porque é o motivo de ela ter aberto o painel —
        os atalhos ficam para quando ela quer mexer em alguma coisa.
      */}
      {resumo && (
        <div className="mt-6 grid gap-2">
          {resumo.reembolsoFalhou > 0 && (
            <Link
              href="/admin/pedidos?situacao=cancelado"
              className="flex items-center gap-3 rounded-2xl px-4 py-3.5 border-2 border-cherryDark bg-blush/60 hover:bg-blush transition-colors"
            >
              <span className="text-xl" aria-hidden>⚠️</span>
              <span className="font-body text-sm text-ink/85">
                <strong className="block text-cherryDark">
                  {resumo.reembolsoFalhou}{" "}
                  {resumo.reembolsoFalhou === 1 ? "devolução não saiu" : "devoluções não saíram"}
                </strong>
                A cliente está esperando o dinheiro de volta. Toque para resolver.
              </span>
            </Link>
          )}

          {resumo.pagos > 0 && (
            <Link
              href="/admin/pedidos?situacao=pago"
              className="flex items-center gap-3 rounded-2xl px-4 py-3.5 bg-green-50 border border-green-300 hover:border-green-500 transition-colors"
            >
              <span className="text-xl" aria-hidden>🍒</span>
              <span className="font-body text-sm text-ink/85">
                <strong className="block text-green-800">
                  {resumo.pagos} {resumo.pagos === 1 ? "pedido pago" : "pedidos pagos"} esperando você começar
                </strong>
                Pagamento confirmado — é só preparar.
              </span>
            </Link>
          )}

          {/* Estas duas são informação, não tarefa: linha discreta. */}
          {(resumo.canceladosRecentes > 0 || resumo.storiesPendentes > 0) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 font-body text-xs text-ink/55">
              {resumo.canceladosRecentes > 0 && (
                <Link href="/admin/pedidos?situacao=cancelado" className="underline">
                  {resumo.canceladosRecentes}{" "}
                  {resumo.canceladosRecentes === 1 ? "cancelamento" : "cancelamentos"} nas últimas 24h
                </Link>
              )}
              {resumo.storiesPendentes > 0 && (
                <Link href="/admin/stories" className="underline">
                  {resumo.storiesPendentes} story esperando aprovação
                </Link>
              )}
              {resumo.emPreparo > 0 && <span>{resumo.emPreparo} em preparo</span>}
              {resumo.aCaminho > 0 && <span>{resumo.aCaminho} a caminho</span>}
            </div>
          )}

          {resumo.precisamDeAcao === 0 && (
            <p className="font-body text-sm text-ink/55 px-1">
              Nada esperando por você agora. 🍒
            </p>
          )}
        </div>
      )}

      {/*
        Depois do resumo, nunca antes: o que ela abriu o painel para ver vem
        primeiro. O convite é oferta, não recado urgente.
      */}
      <div className="empty:hidden mt-8">
        <ConviteInstalar
          chave="dt_convite_painel"
          titulo="Deixe o painel na sua tela de início"
          descricao="Fica com ícone só seu, separado do site da loja — e você abre os pedidos direto, sem passar pelo navegador."
          rotuloDoBotao="Adicionar o painel"
          instrucaoIPhone={
            <>
              Toque em <strong>Compartilhar</strong> aqui embaixo no navegador e depois em{" "}
              <strong>Adicionar à Tela de Início</strong>. O ícone vinho é o seu painel; o claro
              é o site da loja. Na primeira vez ele pede sua senha de novo. 🍒
            </>
          }
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mt-6">
        {atalhos.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="bg-white/70 border border-cherryLight/30 rounded-2xl p-5 hover:border-cherryDark transition-colors"
          >
            <h2 className="font-display text-lg text-cherryDark">{a.label}</h2>
            <p className="text-sm text-ink/60 font-body mt-1">{a.desc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
