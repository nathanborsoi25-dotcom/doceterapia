"use client";

import { useEffect, useState } from "react";
import VoltarAoPainel from "@/components/VoltarAoPainel";
import { getListaClientes } from "@/lib/api";
import type { Cliente } from "@/lib/types";

export default function AdminClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);

  useEffect(() => {
    getListaClientes()
      .then(setClientes)
      .catch(() => setClientes([]));
  }, []);

  return (
    <main className="min-h-screen px-4 sm:px-6 md:px-12 py-8 md:py-10 max-w-3xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl sm:text-3xl text-cherryDark">Meus clientes</h1>
        <VoltarAoPainel />
      </div>

      <div className="grid gap-3 mt-6">
        {clientes.length === 0 && (
          <p className="text-ink/60 font-body">Ainda não há clientes cadastrados.</p>
        )}
        {clientes.map((c) => (
          <div key={c.id} className="bg-white/70 border border-cherryLight/30 rounded-xl p-4 font-body text-sm">
            <p className="font-display text-base text-cherryDark">{c.nome}</p>
            <p>Telefone: {c.telefone}</p>
            <p>
              Endereço: {c.endereco.rua}, {c.endereco.numero} — {c.endereco.bairro},{" "}
              {c.endereco.cidade}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
