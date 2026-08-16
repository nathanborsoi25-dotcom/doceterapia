/**
 * "Vou sair hoje": todo doce de pronta entrega vira encomenda de 1 dia, num
 * clique — e volta ao normal noutro.
 *
 * A Camily faz os doces sozinha. Quando ela precisa sair, o cardápio não pode
 * continuar prometendo doce pronto na hora, e mudar doce por doce no painel
 * é o tipo de trabalho que se esquece de desfazer na volta.
 *
 * ⚠️ **O desfazer é o motivo de este arquivo existir.** Devolver "tudo" para
 * pronta entrega transformaria o brownie de 7 dias num doce pronto na hora.
 * Por isso a pausa guarda a LISTA do que ela mesma alterou, e a volta mexe só
 * nesses. Quem entrou como encomenda continua encomenda.
 */
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "./db";
import { configLoja, produtos, sabores } from "./db/schema";
import { ID_CONFIG } from "./config-loja";

/**
 * Um item que a pausa alterou, com o prazo que ele TINHA antes.
 *
 * ⚠️ Guardar só o id não bastava: doce em pronta entrega pode ter um prazo
 * guardado no cadastro (sobra de quando foi encomenda), e devolver todo mundo
 * com prazo vazio apagava esse número calado. O teste do ciclo completo pegou
 * isso — por isso a volta restaura o valor de cada um, não um padrão.
 */
export type ItemPausado = {
  id: string;
  prazoDias: number | null;
};

/** O que foi alterado quando ela apertou o botão. */
export type PausaProntaEntrega = {
  /** Os doces que estavam em pronta entrega. */
  produtos: ItemPausado[];
  /**
   * Os recheios que tinham disponibilidade PRÓPRIA de pronta entrega.
   * Recheio sem disponibilidade própria herda a do doce, então ele já vira
   * encomenda junto — mexer nele criaria uma regra que não existia antes.
   */
  sabores: ItemPausado[];
  /** Quando começou (ISO), pra tela dizer "desde as 14h". */
  em: string;
};

/** Quantos dias de prazo o doce ganha enquanto ela está fora. */
export const PRAZO_DA_PAUSA = 1;

/**
 * Tira todo mundo da pronta entrega e guarda quem foi alterado.
 *
 * Fica aqui, e não dentro da rota, pra poder ser testado de verdade —
 * `scripts/_teste-pausa-pronta-entrega.ts` liga, confere e desliga.
 */
export async function pausarProntaEntrega(): Promise<PausaProntaEntrega | null> {
  const db = getDb();

  // Só o que está em pronta entrega AGORA entra na lista. Doce que já era
  // encomenda fica como está — e é ele que o desfazer não pode tocar depois.
  // O prazo de cada um vai junto: é o que a volta precisa devolver.
  const doces = await db
    .select({ id: produtos.id, prazoDias: produtos.prazoDias })
    .from(produtos)
    .where(eq(produtos.disponibilidade, "pronta_entrega"));

  /*
   * Recheio SEM disponibilidade própria herda a do doce, então já vira
   * encomenda junto e não precisa (nem deve) ser alterado: mexer nele criaria
   * uma regra que não existia, e o desfazer teria que adivinhar qual apagar.
   */
  const recheios = await db
    .select({ id: sabores.id, prazoDias: sabores.prazoDias })
    .from(sabores)
    .where(eq(sabores.disponibilidade, "pronta_entrega"));

  const idsDoces = doces.map((d) => d.id);
  const idsRecheios = recheios.map((r) => r.id);
  if (idsDoces.length === 0 && idsRecheios.length === 0) return null;

  if (idsDoces.length) {
    await db
      .update(produtos)
      .set({ disponibilidade: "sob_encomenda", prazoDias: PRAZO_DA_PAUSA })
      .where(inArray(produtos.id, idsDoces));
  }
  if (idsRecheios.length) {
    await db
      .update(sabores)
      .set({ disponibilidade: "sob_encomenda", prazoDias: PRAZO_DA_PAUSA })
      .where(inArray(sabores.id, idsRecheios));
  }

  const pausa: PausaProntaEntrega = {
    produtos: doces,
    sabores: recheios,
    em: new Date().toISOString(),
  };

  await db
    .update(configLoja)
    .set({ pausaProntaEntrega: pausa })
    .where(eq(configLoja.id, ID_CONFIG));

  return pausa;
}

/**
 * Devolve à pronta entrega **só quem esta pausa alterou**.
 *
 * ⚠️ A condição do prazo é proposital: se a Camily editou um desses doces à
 * mão durante a pausa (deu a ele 5 dias, por exemplo), a escolha dela vale
 * mais que a do botão, e ele fica como ela deixou.
 */
export async function voltarProntaEntrega(
  pausa: PausaProntaEntrega
): Promise<number> {
  const db = getDb();

  /*
   * Um por um, porque cada item volta com o prazo QUE ELE TINHA — não existe
   * um valor comum pra todos. São poucos doces, e a alternativa (um UPDATE
   * gigante com CASE) trocaria clareza por microssegundos.
   */
  for (const item of pausa.produtos) {
    await db
      .update(produtos)
      .set({ disponibilidade: "pronta_entrega", prazoDias: item.prazoDias })
      .where(
        and(
          eq(produtos.id, item.id),
          eq(produtos.disponibilidade, "sob_encomenda"),
          eq(produtos.prazoDias, PRAZO_DA_PAUSA)
        )
      );
  }

  for (const item of pausa.sabores) {
    await db
      .update(sabores)
      .set({ disponibilidade: "pronta_entrega", prazoDias: item.prazoDias })
      .where(
        and(
          eq(sabores.id, item.id),
          eq(sabores.disponibilidade, "sob_encomenda"),
          eq(sabores.prazoDias, PRAZO_DA_PAUSA)
        )
      );
  }

  await db
    .update(configLoja)
    .set({ pausaProntaEntrega: null })
    .where(eq(configLoja.id, ID_CONFIG));

  return pausa.produtos.length + pausa.sabores.length;
}

/** Está pausado agora? */
export function estaPausado(pausa: PausaProntaEntrega | null | undefined): boolean {
  return Boolean(pausa && (pausa.produtos.length > 0 || pausa.sabores.length > 0));
}

/** Quantos itens a pausa está segurando — o número que a tela mostra. */
export function quantosNaPausa(pausa: PausaProntaEntrega | null | undefined): number {
  if (!pausa) return 0;
  return pausa.produtos.length + pausa.sabores.length;
}

/**
 * "desde hoje às 14h32" / "desde ontem às 20h" — a Camily precisa saber há
 * quanto tempo o cardápio está assim, senão esquece ligado.
 */
export function desdeQuando(pausa: PausaProntaEntrega | null | undefined): string {
  if (!pausa?.em) return "";

  const inicio = new Date(pausa.em);
  if (Number.isNaN(inicio.getTime())) return "";

  const hora = inicio.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

  const dia = (d: Date) =>
    d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const hoje = dia(new Date());
  const ontem = dia(new Date(Date.now() - 86_400_000));
  const doInicio = dia(inicio);

  if (doInicio === hoje) return `hoje às ${hora}`;
  if (doInicio === ontem) return `ontem às ${hora}`;
  return `${doInicio} às ${hora}`;
}
