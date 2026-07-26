import { MercadoPagoConfig } from "mercadopago";

/**
 * Cliente do Mercado Pago, criado a partir do token de acesso guardado na
 * variável de ambiente MERCADOPAGO_ACCESS_TOKEN (nunca no código).
 * Retorna null quando o token não está configurado, pra as rotas
 * responderem de forma amigável em vez de quebrar.
 */
export function getMpClient(): MercadoPagoConfig | null {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) return null;
  return new MercadoPagoConfig({ accessToken });
}
