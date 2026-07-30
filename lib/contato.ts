/** Contato da Camily, usado no rodapé e nos avisos de área de entrega. */

export const TELEFONE_EXIBICAO = "(43) 99634-7895";

/** Formato internacional exigido pelo link do WhatsApp (55 + DDD + número). */
const WHATSAPP_NUMERO = "5543996347895";

/** Monta o link do WhatsApp, opcionalmente já com a mensagem digitada. */
export function linkWhatsApp(mensagem?: string): string {
  return linkWhatsAppNumero(WHATSAPP_NUMERO, mensagem);
}

/**
 * Link do WhatsApp para qualquer número (usado no painel, pra Camily falar
 * com o cliente). Aceita o telefone como estiver salvo — "(43) 99999-9999" —
 * e completa o código do Brasil quando falta.
 */
export function linkWhatsAppNumero(telefone: string, mensagem?: string): string {
  let digitos = (telefone ?? "").replace(/\D/g, "");
  // 10 ou 11 dígitos = número nacional (DDD + telefone), falta o 55.
  if (digitos.length === 10 || digitos.length === 11) digitos = `55${digitos}`;
  const base = `https://wa.me/${digitos}`;
  return mensagem ? `${base}?text=${encodeURIComponent(mensagem)}` : base;
}
