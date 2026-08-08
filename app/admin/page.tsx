"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { logoutAdmin } from "@/lib/api";

const atalhos = [
  { href: "/admin/pedidos", label: "Meus pedidos", desc: "Ver e acompanhar os pedidos recebidos" },
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
  { href: "/admin/retirada", label: "Onde a cliente busca", desc: "Endereços e horários de retirada" },
];

export default function AdminHome() {
  const router = useRouter();

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

      <div className="grid sm:grid-cols-2 gap-4 mt-8">
        {atalhos.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="bg-white/70 border border-cherryLight/30 rounded-cherry p-5 hover:border-cherryDark transition-colors"
          >
            <h2 className="font-display text-lg text-cherryDark">{a.label}</h2>
            <p className="text-sm text-ink/60 font-body mt-1">{a.desc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
