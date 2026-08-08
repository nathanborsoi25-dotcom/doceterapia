/**
 * Link do WhatsApp da loja.
 *
 * O número NÃO mora mais aqui: ele é da Camily e ela troca pelo painel
 * (`/admin/sobre`), então quem chama passa o telefone que veio da configuração
 * da loja. O padrão, para quando ela ainda não mexeu, fica em
 * `lib/config-loja.ts`.
 */

/**
 * Monta o link do WhatsApp para qualquer número — o da loja no rodapé, o da
 * cliente no painel. Aceita o telefone como estiver salvo ("(43) 99999-9999")
 * e completa o código do Brasil quando falta.
 */
export function linkWhatsAppNumero(telefone: string, mensagem?: string): string {
  let digitos = (telefone ?? "").replace(/\D/g, "");
  // 10 ou 11 dígitos = número nacional (DDD + telefone), falta o 55.
  if (digitos.length === 10 || digitos.length === 11) digitos = `55${digitos}`;
  const base = `https://wa.me/${digitos}`;
  return mensagem ? `${base}?text=${encodeURIComponent(mensagem)}` : base;
}
