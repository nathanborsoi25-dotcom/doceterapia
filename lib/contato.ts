/** Contato da Camily, usado no rodapé e nos avisos de área de entrega. */

export const TELEFONE_EXIBICAO = "(43) 99634-7895";

/** Formato internacional exigido pelo link do WhatsApp (55 + DDD + número). */
const WHATSAPP_NUMERO = "5543996347895";

/** Monta o link do WhatsApp, opcionalmente já com a mensagem digitada. */
export function linkWhatsApp(mensagem?: string): string {
  const base = `https://wa.me/${WHATSAPP_NUMERO}`;
  return mensagem ? `${base}?text=${encodeURIComponent(mensagem)}` : base;
}
