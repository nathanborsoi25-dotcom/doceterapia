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

  const resultados: Record<string, unknown> = {};

  for (const forma of ["pix", "credito"] as const) {
    try {
      const url = await criarPreferenciaDoPedido(client, {
        ...base,
        formaPagamento: forma,
        // O desconto do Pix entra como item negativo, igual na venda real.
        descontoPix: forma === "pix" ? 0.76 : 0,
      });
      resultados[forma] = { ok: true, abriu: Boolean(url) };
    } catch (e) {
      resultados[forma] = { ok: false, ...motivoDaRecusa(e) };
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

  return NextResponse.json({
    config,
    preferencias: resultados,
    pixNaConta: formasDaConta,
  });
}
