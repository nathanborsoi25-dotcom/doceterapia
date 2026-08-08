"use client";

import { useEffect, useState } from "react";
import { SOBRE_PADRAO, sobreDaLoja } from "./config-loja";
import { linkWhatsAppNumero } from "./contato";

/**
 * Foto, recadinho e telefone da Camily nas telas do cliente.
 *
 * Começa devolvendo o padrão em vez de vazio: o rodapé aparece completo já na
 * primeira pintura e só troca o conteúdo quando a resposta chega — sem o
 * telefone piscando em branco na tela de quem está procurando justamente por
 * ele.
 *
 * A busca é uma só por carregamento de página, guardada aqui no módulo. Sem
 * isso, cada rodapé e cada botão de WhatsApp faria a sua própria ida ao
 * servidor pedindo o mesmo dado.
 */
export type Sobre = {
  foto: string;
  texto: string;
  telefone: string;
};

const PADRAO: Sobre = { foto: "", texto: SOBRE_PADRAO.texto, telefone: SOBRE_PADRAO.telefone };

let emAndamento: Promise<Sobre> | null = null;

function buscar(): Promise<Sobre> {
  emAndamento ??= fetch("/api/config-loja", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((c) => (c ? sobreDaLoja(c) : PADRAO))
    .catch(() => {
      // Deu ruim na rede: esquece esta tentativa pra próxima tela poder
      // tentar de novo, e segue com o padrão.
      emAndamento = null;
      return PADRAO;
    });
  return emAndamento;
}

export function useSobre(): Sobre & { linkWhatsApp: (mensagem?: string) => string } {
  const [sobre, setSobre] = useState<Sobre>(PADRAO);

  useEffect(() => {
    let vivo = true;
    buscar().then((s) => {
      if (vivo) setSobre(s);
    });
    return () => {
      vivo = false;
    };
  }, []);

  return {
    ...sobre,
    linkWhatsApp: (mensagem?: string) => linkWhatsAppNumero(sobre.telefone, mensagem),
  };
}
