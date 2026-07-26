"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { logoutAdmin } from "@/lib/api";

const atalhos = [
  { href: "/admin/pedidos", label: "Meus pedidos", desc: "Ver e acompanhar os pedidos recebidos" },
  { href: "/admin/produtos", label: "Meus produtos", desc: "Editar fotos, título, descrição e preço" },
  { href: "/admin/produtos/novo", label: "Adicionar produto", desc: "Cadastrar um novo doce no cardápio" },
  { href: "/admin/frete", label: "Configurar frete", desc: "Faixas de distância e valores" },
  { href: "/admin/clientes", label: "Meus clientes", desc: "Quem já fez cadastro no site" },
];

export default function AdminHome() {
  const router = useRouter();

  async function sair() {
    await logoutAdmin();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <main className="min-h-screen px-6 md:px-12 py-10 max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-cherryDark">Painel Doceterapia</h1>
          <p className="text-ink/70 font-body mt-1">Só você vê essa área.</p>
        </div>
        <button
          onClick={sair}
          className="text-sm font-body text-cherryDark border border-cherryLight/50 rounded-full px-4 py-1.5 hover:bg-blush transition-colors"
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
