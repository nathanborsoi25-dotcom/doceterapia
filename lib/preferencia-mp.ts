import { Preference } from "mercadopago";
import type MercadoPagoConfig from "mercadopago";
import type { ItemPedido } from "./types";

/**
 * A tela de pagamento do Mercado Pago para um pedido.
 *
 * Vive aqui, e não dentro da rota, porque dois caminhos precisam dela: a
 * criação do pedido e a **retomada** — quando a cliente fecha o Mercado Pago
 * sem pagar e volta depois pela conta dela. Nos dois casos a tela precisa
 * abrir igualzinha: mesmos itens, mesmo frete, mesmo desconto.
 */

/** Telefone no formato que o Mercado Pago espera, ou nada. */
export function dddETelefone(telefone: string | null | undefined) {
  const d = (telefone ?? "").replace(/\D/g, "");
  if (d.length !== 10 && d.length !== 11) return null;
  return { area_code: d.slice(0, 2), number: d.slice(2) };
}

export type DadosDaPreferencia = {
  pedidoId: string;
  itens: ItemPedido[];
  valorFrete: number;
  desconto: number;
  cupomCodigo: string | null;
  comprador: { nome: string; email: string; telefone?: string | null };
  /** De onde saiu o pedido, pras URLs de volta. */
  origin: string;
  /**
   * Cupom de Pix: o Checkout passa a oferecer só Pix. Sem isso, bastaria
   * escolher Pix no site e trocar para cartão na tela do Mercado Pago.
   */
  obrigarPix?: boolean;
};

export async function criarPreferenciaDoPedido(
  client: MercadoPagoConfig,
  dados: DadosDaPreferencia
): Promise<string | null> {
  const { pedidoId, itens, valorFrete, desconto, cupomCodigo, comprador, origin } =
    dados;

  const produtos = itens.map((i) => ({
    id: i.produtoId,
    title: i.nome,
    quantity: i.quantidade,
    unit_price: i.precoUnitario,
    currency_id: "BRL",
  }));

  // O desconto do cupom vai como item negativo, que é como o Mercado Pago
  // aceita abatimento: o total cobrado já sai certo na tela dele.
  const items =
    desconto > 0
      ? [
          ...produtos,
          {
            id: "desconto",
            title: `Desconto${cupomCodigo ? ` (cupom ${cupomCodigo})` : ""}`,
            quantity: 1,
            unit_price: -desconto,
            currency_id: "BRL",
          },
        ]
      : produtos;

  // O MP não aceita URL local para notificação; só manda em produção.
  const ehLocal = origin.includes("localhost") || origin.includes("127.0.0.1");
  const telefone = dddETelefone(comprador.telefone);

  const pref = await new Preference(client).create({
    body: {
      items,
      shipments:
        valorFrete > 0 ? { cost: valorFrete, mode: "not_specified" } : undefined,
      /**
       * Quem está comprando, já preenchido. Sem isto o Mercado Pago abre
       * pedindo o e-mail de novo, no meio do pagamento — e o comprovante
       * corre o risco de ir parar num e-mail diferente do cadastro. Os dados
       * saem da SESSÃO, nunca do que o navegador mandou.
       */
      payer: {
        name: comprador.nome.split(" ")[0],
        surname: comprador.nome.split(" ").slice(1).join(" ") || undefined,
        email: comprador.email,
        ...(telefone ? { phone: telefone } : {}),
      },
      external_reference: pedidoId,
      back_urls: {
        success: `${origin}/pedido/sucesso`,
        pending: `${origin}/pedido/sucesso`,
        failure: `${origin}/pedido/erro`,
      },
      auto_return: "approved",
      payment_methods: {
        // Crédito à vista (sem parcelamento).
        installments: 1,
        default_installments: 1,
        /*
         * Boleto sempre fora. Com cupom de Pix, o cartão também sai: o
         * desconto só se paga porque o Pix custa 0,99% em vez de 4,98%.
         */
        excluded_payment_types: dados.obrigarPix
          ? [{ id: "ticket" }, { id: "credit_card" }, { id: "debit_card" }, { id: "atm" }]
          : [{ id: "ticket" }],
      },
      ...(ehLocal ? {} : { notification_url: `${origin}/api/pagamento/webhook` }),
    },
  });

  return pref.init_point ?? pref.sandbox_init_point ?? null;
}
