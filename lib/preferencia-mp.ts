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
  /** Abatimento por pagar no Pix, em reais. Entra como item negativo. */
  descontoPix?: number;
  comprador: { nome: string; email: string; telefone?: string | null };
  /** De onde saiu o pedido, pras URLs de volta. */
  origin: string;
  /**
   * A forma que a pessoa escolheu no botão de pagar. O Checkout abre TRAVADO
   * nela: quem clicou em "Pagar com Pix" não vê cartão, e quem clicou em
   * cartão não vê Pix.
   *
   * Isso não é capricho. O desconto do Pix é calculado antes, no nosso lado —
   * sem a trava, bastaria clicar em Pix, ganhar os 4% e trocar para cartão na
   * tela do Mercado Pago: a Camily pagaria o desconto E a taxa cheia. E,
   * já que a forma está decidida, ninguém precisa escolher duas vezes.
   */
  formaPagamento?: string;
};

/**
 * Os tipos de pagamento do Mercado Pago.
 *
 * A regra abaixo funciona ao contrário: em vez de dizer o que tirar — e
 * esquecer algum —, ela diz o que FICA e tira todo o resto. Foi o
 * esquecimento que deixou o saldo em conta aparecer na tela do Pix.
 *
 * ⚠️ **Só entram aqui `payment_type_id` de verdade.** O Mercado Pago recusa a
 * preferência inteira (erro 400, que chega como 500 na nossa tela) se um valor
 * desconhecido for para `excluded_payment_types`. Foi exatamente isso que
 * derrubou o pagamento em 11/08/2026: `consumer_credits` e `credits` estavam
 * nesta lista, mas são **método**, não tipo — o lugar deles é
 * `excluded_payment_methods`, mais abaixo.
 */
const TIPOS_DO_MERCADO_PAGO = [
  "credit_card",
  "debit_card",
  "prepaid_card",
  "ticket", // boleto
  "bank_transfer", // Pix
  "atm",
  "account_money", // saldo na conta do Mercado Pago
  "digital_currency",
  /*
   * Carteira digital do próprio Mercado Pago.
   *
   * ⚠️ Já esteve escrito aqui que "é por onde o Apple Pay aparece". **Não é**:
   * o Mercado Pago não tem integração com Apple Pay no Brasil (conferido em
   * 18/08/2026). O que o iPhone faz é o Safari preencher o cartão salvo com
   * Face ID — recurso do navegador, que funciona em qualquer formulário.
   */
  "digital_wallet",
  "voucher_card",
  "crypto_transfer",
];

/**
 * ⚠️ **O saldo em conta do Mercado Pago NÃO pode ser excluído.**
 *
 * Ele recusa a preferência inteira com `account_money cannot be excluded`
 * (400) — é política dele, não erro nosso. Em 13/08/2026 isso derrubou o Pix
 * por horas: a loja vendia no cartão e o botão do Pix dava erro, porque a
 * regra do Pix mandava excluir tudo menos `bank_transfer`, e nesse "tudo"
 * estava o `account_money`. O cartão escapava só porque a lista dele já
 * mantinha o saldo entre os permitidos.
 *
 * Quem descobriu foi `/api/admin/diagnostico-pagamento`, que monta as duas
 * preferências e devolve a recusa crua — sem ela, o motivo ficava só no log
 * da Vercel, que não dá pra ler.
 */
const NAO_DA_PRA_EXCLUIR = ["account_money"];

/**
 * O que o Checkout NÃO deve oferecer, a partir do botão que a pessoa apertou.
 *
 * - **Pix**: fica o Pix — e o saldo em conta junto, porque o Mercado Pago não
 *   deixa tirá-lo. Sem Mercado Crédito e sem cartão.
 * - **Crédito**: cartão de crédito, saldo em conta e a carteira digital do
 *   Mercado Pago. Fora o Mercado Crédito, que é parcelamento — e a loja não
 *   trabalha com parcelamento.
 *
 * Boleto fica sempre de fora, por decisão da loja.
 */
function tiposExcluidos(forma?: string): { id: string }[] {
  const permitidos =
    forma === "pix"
      ? ["bank_transfer"]
      : forma === "credito"
        ? ["credit_card", "account_money", "digital_wallet"]
        : // Sem forma escolhida, só o boleto sai (não deve acontecer hoje).
          TIPOS_DO_MERCADO_PAGO.filter((t) => t !== "ticket");

  return TIPOS_DO_MERCADO_PAGO.filter(
    (t) => !permitidos.includes(t) && !NAO_DA_PRA_EXCLUIR.includes(t)
  ).map((id) => ({ id }));
}

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

  /*
   * Descontos vão como itens negativos, que é como o Mercado Pago aceita
   * abatimento: o total cobrado já sai certo na tela dele. São duas linhas
   * separadas de propósito — o cupom e o Pix aparecem cada um com o seu nome,
   * pra pessoa entender de onde veio cada abatimento.
   */
  const items = [...produtos];

  if (desconto > 0) {
    items.push({
      id: "desconto",
      title: `Desconto${cupomCodigo ? ` (cupom ${cupomCodigo})` : ""}`,
      quantity: 1,
      unit_price: -desconto,
      currency_id: "BRL",
    });
  }

  if ((dados.descontoPix ?? 0) > 0) {
    items.push({
      id: "desconto-pix",
      title: "Desconto pagando no Pix",
      quantity: 1,
      unit_price: -(dados.descontoPix ?? 0),
      currency_id: "BRL",
    });
  }

  // O MP não aceita URL local para notificação; só manda em produção.
  const ehLocal = origin.includes("localhost") || origin.includes("127.0.0.1");
  const telefone = dddETelefone(comprador.telefone);

  /*
   * No Pix, tenta tirar o saldo em conta pelo NOME do método.
   *
   * Por tipo é proibido (`account_money cannot be excluded`), mas por método
   * pode passar — e vale muito a pena tentar: o desconto de 4% do Pix só se
   * paga porque o Pix custa 0,99% de taxa. Se a cliente aperta "Pagar com
   * Pix", ganha o desconto e paga com saldo, a Camily banca os 4% E os 4,99%
   * do saldo. É a única forma que sobra na tela dele capaz de fazer isso.
   *
   * Se o Mercado Pago recusar essa exclusão também, a chamada é refeita sem
   * ela — melhor vender com o risco do que não vender.
   */
  const bloquearSaldoNoPix =
    dados.formaPagamento === "pix" ? [{ id: "account_money" }] : [];

  const montarCorpo = (excluirSaldo: boolean) => ({
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
        excluded_payment_types: tiposExcluidos(dados.formaPagamento),
        /*
         * O Mercado Crédito também sai pelo NOME do método, não só pelo tipo.
         * O Mercado Pago o trata dos dois jeitos dependendo da conta, e é
         * parcelamento disfarçado — a loja não trabalha com parcelamento.
         */
        excluded_payment_methods: [
          { id: "consumer_credits" },
          ...(excluirSaldo ? bloquearSaldoNoPix : []),
        ],
      },
      ...(ehLocal ? {} : { notification_url: `${origin}/api/pagamento/webhook` }),
  });

  /** O Mercado Pago recusou porque não deixa excluir aquela forma? */
  const ehRecusaDeExclusao = (e: unknown) =>
    String((e as { message?: string })?.message ?? e).includes("cannot be excluded");

  try {
    const pref = await new Preference(client).create({
      body: montarCorpo(bloquearSaldoNoPix.length > 0),
    });
    return pref.init_point ?? pref.sandbox_init_point ?? null;
  } catch (e) {
    // Só a recusa da exclusão tem segunda tentativa. Qualquer outro erro é
    // problema de verdade e precisa subir — engolir aqui esconderia, por
    // exemplo, um item com valor inválido.
    if (!bloquearSaldoNoPix.length || !ehRecusaDeExclusao(e)) throw e;

    console.warn(
      "MP não deixou tirar o saldo em conta da tela do Pix; seguindo sem essa trava."
    );
    const pref = await new Preference(client).create({ body: montarCorpo(false) });
    return pref.init_point ?? pref.sandbox_init_point ?? null;
  }
}
