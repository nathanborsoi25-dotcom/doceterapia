"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getClienteAtual } from "@/lib/store";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const cliente = getClienteAtual();
    router.replace(cliente ? "/catalogo" : "/cadastro");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center font-display text-cherryDark">
      Carregando a Doceterapia...
    </div>
  );
}
