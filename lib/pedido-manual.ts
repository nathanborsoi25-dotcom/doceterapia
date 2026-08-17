/**
 * Pedido lançado à mão pela Camily: venda de balcão ou combinada no WhatsApp.
 *
 * Existe porque nem toda venda nasce no site — a cliente encontra ela na rua,
 * manda mensagem, aparece na porta. Antes essas vendas ficavam fora do
 * sistema: sem baixa de estoque, sem pontos para a cliente e fora das
 * métricas, que é justamente onde ela olha para saber como o mês está indo.
 *
 * ⚠️ **Preço, nome e prazo saem do BANCO**, como no pedido do site. A tela
 * manda só o que a Camily escolheu (id do doce, recheio e quantidade): assim
 * a venda de balcão entra com o mesmo valor do cardápio, e a métrica de uma
 * não desmente a da outra.
 *
 * ⚠️ **Não passa pelo Mercado Pago.** É dinheiro na mão dela, e por isso a
 * forma de pagamento é `dinheiro`, com taxa zero (`lib/taxas-mp.ts`).
 *
 * A conta mora aqui, e não na rota, pra poder ser testada sem precisar de
 * sessão de admin — `scripts/_teste-pedido-manual.ts`.
 */
import { eq, inArray } from "drizzle-orm";
import { getDb } from "./db";
import { clientes, pedidos, produtos, sabores } from "./db/schema";
import { baixarEstoque, conferirEstoque, mensagemDeFalta } from "./estoque";
import { garantirPontosDaCompra } from "./fidelidade";
import { precoAPagar, precoCheio } from "./promocao";
import { prazoDoSabor } from "./sabores";
import { dataMinimaRetirada, prazoMaximoEmDias } from "./prazo";
import { normalizarTelefone } from "./validacoes";
import type { ItemPedido, StatusPedido } from "./types";

export type ItemDoBalcao = { produtoId?: string; saborId?: string; quantidade?: number };

export type PedidoManual = {
  itens?: ItemDoBalcao[];
  /** Cadastro escolhido na busca — opcional. */
  clienteId?: string;
  /** Quando não há cadastro: o que ela souber da pessoa. Tudo opcional. */
  nomeContato?: string;
  telefoneContato?: string;
  tipoEntrega?: "entrega" | "retirada";
  /** Endereço escrito à mão (só entrega). */
  enderecoTexto?: string;
  /** Quanto ela vai cobrar de entrega. Ela decide: pode ser zero. */
  valorFrete?: number;
  /** Abatimento combinado na hora ("faz um precinho"). */
  desconto?: number;
  status?: StatusPedido;
};

export type ResultadoPedidoManual =
  | { ok: true; pedidoId: string; total: number }
  | { ok: false; erro: string; status: number };

/** As situações que fazem sentido para uma venda que já aconteceu. */
const SITUACOES_ACEITAS: StatusPedido[] = ["pago", "em_preparo", "pronto", "concluido"];

function texto(valor: unknown, limite: number): string {
  return typeof valor === "string" ? valor.trim().slice(0, limite) : "";
}

export async function criarPedidoManual(
  dados: PedidoManual
): Promise<ResultadoPedidoManual> {
  const recebidos = (dados.itens ?? []).filter((i) => i?.produtoId);
  if (recebidos.length === 0) {
    return { ok: false, erro: "Escolha pelo menos um doce.", status: 400 };
  }

  const db = getDb();

  // ---- Os itens, remontados a partir do banco ----
  const ids = Array.from(new Set(recebidos.map((i) => i.produtoId!)));
  const doBanco = await db.select().from(produtos).where(inArray(produtos.id, ids));
  const porId = new Map(doBanco.map((p) => [p.id, p]));

  const recheios = await db.select().from(sabores).where(inArray(sabores.produtoId, ids));
  const saborPorId = new Map(recheios.map((s) => [s.id, s]));

  const itens: ItemPedido[] = [];
  for (const recebido of recebidos) {
    const produto = porId.get(recebido.produtoId!);
    if (!produto) return { ok: false, erro: "Um dos doces não existe mais.", status: 400 };

    const quantidade = Math.floor(Number(recebido.quantidade ?? 1));
    if (!Number.isFinite(quantidade) || quantidade < 1 || quantidade > 200) {
      return { ok: false, erro: "Quantidade inválida.", status: 400 };
    }

    const sabor = recebido.saborId ? saborPorId.get(recebido.saborId) : undefined;
    if (recebido.saborId && (!sabor || sabor.produtoId !== produto.id)) {
      return {
        ok: false,
        erro: `O recheio escolhido para ${produto.nome} não existe.`,
        status: 400,
      };
    }

    const cheio = precoCheio(produto, sabor);
    const aPagar = precoAPagar(produto, sabor);

    itens.push({
      produtoId: produto.id,
      nome: produto.nome,
      precoUnitario: aPagar,
      quantidade,
      saborId: sabor?.id,
      saborNome: sabor?.nome,
      emPromocao: aPagar < cheio,
      precoCheio: aPagar < cheio ? cheio : undefined,
    });
  }

  /*
   * O estoque é conferido, e não ignorado: se o doce acabou, quem está no
   * balcão precisa saber antes de prometer. Doce sem controle de estoque
   * passa direto, como no site.
   */
  const faltas = conferirEstoque(itens, porId, saborPorId);
  if (faltas.length > 0) return { ok: false, erro: mensagemDeFalta(faltas), status: 409 };

  // ---- Quem pediu ----
  let clienteId: string | null = null;
  if (dados.clienteId) {
    const [existe] = await db.select().from(clientes).where(eq(clientes.id, dados.clienteId));
    if (!existe) return { ok: false, erro: "Cliente não encontrado.", status: 400 };
    clienteId = existe.id;
  }

  // Sem cadastro, fica o que ela souber — e pode não saber nada.
  const nomeContato = clienteId ? null : texto(dados.nomeContato, 120) || null;
  const telefoneContato = clienteId
    ? null
    : normalizarTelefone(texto(dados.telefoneContato, 30)) || null;

  // ---- Entrega ----
  const tipoEntrega = dados.tipoEntrega === "entrega" ? "entrega" : "retirada";
  const valorFrete =
    tipoEntrega === "entrega" ? Math.max(0, Number(dados.valorFrete) || 0) : 0;

  const subtotal = itens.reduce((soma, i) => soma + i.precoUnitario * i.quantidade, 0);
  const desconto = Math.min(Math.max(0, Number(dados.desconto) || 0), subtotal);

  // ---- Prazo, pela mesma régua do site ----
  const prazoDias = prazoMaximoEmDias(
    itens.map((i) => {
      const produto = porId.get(i.produtoId);
      if (!produto) return 0;
      const sabor = i.saborId ? saborPorId.get(i.saborId) : undefined;
      return prazoDoSabor(
        {
          disponibilidade: produto.disponibilidade as "pronta_entrega" | "sob_encomenda",
          prazoDias: produto.prazoDias ?? undefined,
        },
        sabor
          ? {
              disponibilidade: sabor.disponibilidade as
                | "pronta_entrega"
                | "sob_encomenda"
                | null,
              prazoDias: sabor.prazoDias,
            }
          : undefined
      );
    })
  );

  const status = SITUACOES_ACEITAS.includes(dados.status as StatusPedido)
    ? (dados.status as StatusPedido)
    : "pago";

  const id = crypto.randomUUID();
  await db.insert(pedidos).values({
    id,
    clienteId,
    itens,
    tipoEntrega,
    dataAgendada: "",
    pontoRetirada: tipoEntrega === "retirada" ? "Combinado com a Camily" : null,
    prazoEm: dataMinimaRetirada(prazoDias),
    enderecoEntrega: null,
    /*
     * O endereço escrito à mão entra no bilhete: é o campo que o painel já
     * mostra por extenso, e a venda de balcão raramente tem CEP e número
     * separados para preencher o endereço estruturado.
     */
    bilhete: tipoEntrega === "entrega" ? texto(dados.enderecoTexto, 500) || null : null,
    ehPresente: false,
    nomeQuemRecebe: null,
    valorFrete,
    cupomCodigo: null,
    desconto,
    descontoPix: 0,
    formaPagamento: "dinheiro",
    status,
    origem: "painel",
    nomeContato,
    telefoneContato,
  });

  // O doce sai do estoque agora: ele foi entregue (ou vai ser).
  await baixarEstoque(itens);

  // Cliente com cadastro pontua igual a quem compra pelo site.
  if (clienteId) await garantirPontosDaCompra(id);

  return { ok: true, pedidoId: id, total: subtotal - desconto + valorFrete };
}
