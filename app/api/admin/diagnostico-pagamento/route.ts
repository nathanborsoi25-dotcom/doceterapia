import { NextResponse } from "next/server";
import { Preference } from "mercadopago";
import { requireAdmin } from "@/lib/require-admin";
import { getMpClient } from "@/lib/mercadopago";
import { criarPreferenciaDoPedido } from "@/lib/preferencia-mp";

export const dynamic = "force-dynamic";

/**
 * Por que o Mercado Pago recusou a tela de pagamento.
 *
 * Quando ele recusa uma preferência, o motivo fica só no log da Vercel — e a
 * cliente vê apenas "não consegui abrir a tela de pagamento". Em 13/08/2026 o
 * **Pix** parou de abrir enquanto o **cartão** continuava funcionando, e sem
 * ler a recusa não dá pra saber o que ele não aceitou.
 *
 * Esta rota tenta montar as duas preferências (Pix e crédito), do mesmo jeito
 * que a loja monta, e devolve a resposta CRUA do Mercado Pago. Só o admin
 * logado enxerga, e o token nunca é devolvido — só o comecinho, pra conferir
 * que é o de produção.
 *
 * Nada é cobrado: preferência é só a tela de pagamento, e nenhuma é aberta.
 */

/** Tira a mensagem de dentro do erro do SDK, que embrulha a resposta do MP. */
function motivoDaRecusa(e: unknown): Record<string, unknown> {
  const erro = e as {
    message?: string;
    status?: number;
    cause?: unknown;
    error?: string;
  };
  return {
    mensagem: erro?.message ?? String(e),
    status: erro?.status ?? null,
    // O `cause` é onde o SDK guarda o corpo do erro do Mercado Pago, que é
    // quem diz qual campo foi recusado.
    causa: (() => {
      try {
        return JSON.parse(JSON.stringify(erro?.cause ?? null));
      } catch {
        return String(erro?.cause ?? "");
      }
    })(),
  };
}

export async function GET(req: Request) {
  const negado = await requireAdmin();
  if (negado) return negado;

  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  const config = {
    temToken: Boolean(token),
    /** APP_USR = produção · TEST = sandbox. É a diferença que mais confunde. */
    tokenComecaCom: token ? `${token.slice(0, 8)}…` : null,
    ambiente: token?.startsWith("APP_USR") ? "produção" : token ? "teste" : null,
  };

  const client = getMpClient();
  if (!client) {
    return NextResponse.json({
      config,
      diagnostico: "Falta MERCADOPAGO_ACCESS_TOKEN nas variáveis do servidor.",
    });
  }

  const origin = new URL(req.url).origin;

  /** Um pedido de mentirinha, com o mesmo formato do de verdade. */
  const base = {
    pedidoId: `diagnostico-${Date.now()}`,
    itens: [
      {
        produtoId: "teste",
        nome: "Doce de teste (diagnóstico)",
        precoUnitario: 19,
        quantidade: 1,
      },
    ],
    valorFrete: 0,
    desconto: 0,
    cupomCodigo: null,
    comprador: {
      nome: "Teste Diagnostico",
      email: "teste@doceterapia.net.br",
      telefone: null,
    },
    origin,
  };

  /*
   * As variações existem pra separar as duas suspeitas sem chutar.
   *
   * O Pix é a única forma que leva um item de preço NEGATIVO (o desconto de
   * 4%), e é a única que exclui `credit_card`, `account_money` e
   * `digital_wallet`. Testando as combinações, a que falhar aponta o culpado —
   * e mexer no pagamento no escuro já derrubou a loja uma vez.
   */
  const variacoes = [
    {
      nome: "1-pix-como-esta-hoje",
      oQueTesta: "Pix do jeito que a loja manda hoje (com o desconto de 4%)",
      dados: { formaPagamento: "pix", descontoPix: 0.76 },
    },
    {
      nome: "2-pix-sem-o-desconto",
      oQueTesta: "Pix SEM o item negativo do desconto — isola o desconto",
      dados: { formaPagamento: "pix", descontoPix: 0 },
    },
    {
      nome: "3-pix-sem-travar-a-forma",
      oQueTesta: "Com o desconto, mas sem excluir forma nenhuma — isola a trava",
      dados: { formaPagamento: undefined, descontoPix: 0.76 },
    },
    {
      nome: "4-credito-como-esta-hoje",
      oQueTesta: "Cartão do jeito que a loja manda hoje (o que funciona)",
      dados: { formaPagamento: "credito", descontoPix: 0 },
    },
  ] as const;

  /**
   * O saldo em conta dá pra bloquear por FORA da lista de tipos?
   *
   * Ele não pode sair por `excluded_payment_types` — é o que quebrou o Pix.
   * Se sair por `excluded_payment_methods`, a trava do Pix volta inteira e o
   * desconto de 4% deixa de correr o risco de ser pago junto com a taxa de
   * 4,99% do saldo. Se também não sair, o jeito é conviver com ele na tela.
   */
  let bloquearSaldoPorMetodo: Record<string, unknown>;
  try {
    const pref = await new Preference(client).create({
      body: {
        items: [
          {
            id: "teste",
            title: "Doce de teste (diagnóstico)",
            quantity: 1,
            unit_price: 19,
            currency_id: "BRL",
          },
        ],
        payer: { email: base.comprador.email },
        payment_methods: {
          installments: 1,
          excluded_payment_types: [
            { id: "credit_card" },
            { id: "debit_card" },
            { id: "ticket" },
          ],
          excluded_payment_methods: [{ id: "account_money" }],
        },
      },
    });
    bloquearSaldoPorMetodo = {
      oQueTesta:
        "Tirar o saldo em conta por excluded_payment_methods, em vez de por tipo",
      ok: true,
      abriu: Boolean(pref.init_point),
    };
  } catch (e) {
    bloquearSaldoPorMetodo = {
      oQueTesta:
        "Tirar o saldo em conta por excluded_payment_methods, em vez de por tipo",
      ok: false,
      ...motivoDaRecusa(e),
    };
  }

  const resultados: Record<string, unknown> = {};

  for (const v of variacoes) {
    try {
      const url = await criarPreferenciaDoPedido(client, {
        ...base,
        formaPagamento: v.dados.formaPagamento,
        descontoPix: v.dados.descontoPix,
      });
      resultados[v.nome] = { oQueTesta: v.oQueTesta, ok: true, abriu: Boolean(url) };
    } catch (e) {
      resultados[v.nome] = { oQueTesta: v.oQueTesta, ok: false, ...motivoDaRecusa(e) };
    }
  }

  /*
   * Quais formas a conta dela realmente oferece.
   *
   * Se o Pix não estiver habilitado na conta do Mercado Pago, nenhuma mexida
   * no código resolve — e é o tipo de coisa que só dá pra descobrir
   * perguntando pra ele.
   */
  let formasDaConta: unknown = null;
  try {
    const r = await fetch("https://api.mercadopago.com/v1/payment_methods", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const lista = (await r.json()) as Array<{
      id: string;
      payment_type_id: string;
      status: string;
    }>;
    formasDaConta = Array.isArray(lista)
      ? lista
          .filter((m) => m.payment_type_id === "bank_transfer" || m.id === "pix")
          .map((m) => ({ id: m.id, tipo: m.payment_type_id, situacao: m.status }))
      : lista;
  } catch (e) {
    formasDaConta = { erro: String(e) };
  }

  /** A leitura pronta, pra não precisar interpretar JSON à mão. */
  const passou = (n: string) => (resultados[n] as { ok?: boolean })?.ok === true;
  const saldoSaiPorMetodo = bloquearSaldoPorMetodo.ok === true;

  const leitura = passou("1-pix-como-esta-hoje")
    ? saldoSaiPorMetodo
      ? "TUDO CERTO, e ainda dá pra tirar o saldo em conta da tela do Pix (ele sai por excluded_payment_methods). Vale fechar essa porta: quem paga com saldo ganharia o desconto de 4% e ainda custaria 4,99% de taxa."
      : "TUDO CERTO: o Pix abre. O saldo em conta continua aparecendo na tela dele e não há como tirar — o Mercado Pago não deixa, nem por tipo nem por método."
    : passou("2-pix-sem-o-desconto")
      ? "O CULPADO É O DESCONTO: o Mercado Pago não está aceitando o item de valor negativo. Some com o item negativo e distribua o desconto no preço dos doces."
      : passou("3-pix-sem-travar-a-forma")
        ? "O CULPADO É A TRAVA DE FORMA: alguma coisa em excluded_payment_types está sendo recusada quando sobra só o Pix. Olhe a `mensagem` do teste 1 — ela diz o nome exato."
        : "Nem o Pix simples passou — olhe `pixNaConta`: pode ser que o Pix não esteja habilitado nessa conta do Mercado Pago.";

  return NextResponse.json({
    leitura,
    config,
    preferencias: resultados,
    bloquearSaldoPorMetodo,
    pixNaConta: formasDaConta,
  });
}
