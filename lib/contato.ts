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
/**
 * O @ da loja no Instagram.
 *
 * Este fica no código, e não no painel como o telefone: o perfil é o mesmo de
 * onde vem quase toda a visita, e trocar de @ é coisa que acontece uma vez na
 * vida — enquanto o número de WhatsApp ela pode querer mudar sozinha.
 */
export const INSTAGRAM_DA_LOJA = "doceterapia_28";

/** O endereço do perfil, para o ícone do rodapé e do perfil da loja. */
export function linkInstagram(arroba: string = INSTAGRAM_DA_LOJA): string {
  return `https://instagram.com/${arroba.replace(/^@/, "")}`;
}

export function linkWhatsAppNumero(telefone: string, mensagem?: string): string {
  let digitos = (telefone ?? "").replace(/\D/g, "");
  // 10 ou 11 dígitos = número nacional (DDD + telefone), falta o 55.
  if (digitos.length === 10 || digitos.length === 11) digitos = `55${digitos}`;
  const base = `https://wa.me/${digitos}`;
  return mensagem ? `${base}?text=${encodeURIComponent(mensagem)}` : base;
}
