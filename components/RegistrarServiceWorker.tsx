"use client";

import { useEffect } from "react";

/**
 * Liga o `public/sw.js` — o arquivo sem o qual o Android não deixa instalar o
 * site na tela de início. O porquê está lá dentro; aqui só o registro.
 *
 * Roda depois da tela montada e engole o próprio erro: navegador que recusa
 * (aba anônima, armazenamento bloqueado, http em rede local) não pode
 * derrubar o cardápio por causa de um recurso que é conveniência.
 */
export default function RegistrarServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // O escopo é a raiz: o mesmo arquivo serve à loja e ao painel, que têm
    // manifestos diferentes mas moram no mesmo domínio.
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Sem service worker o site continua inteiro — só não aparece o convite
      // de instalar no Android.
    });
  }, []);

  return null;
}
