/**
 * Faixas de tempo das métricas. Cada faixa vem com a faixa ANTERIOR de
 * mesmo tamanho, que é o que permite dizer "subiu 20% em relação ao mês
 * passado" — julho compara com junho, hoje compara com ontem.
 */

export type NomePeriodo = "hoje" | "semana" | "mes" | "trimestre" | "tudo";

export type Periodo = {
  inicio: Date;
  fim: Date;
  /** Nulo em "desde o início": não existe período anterior pra comparar. */
  anterior: { inicio: Date; fim: Date } | null;
  rotulo: string;
  rotuloAnterior: string;
};

function inicioDoDia(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function fimDoDia(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function somarDias(d: Date, dias: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + dias);
  return x;
}

export function calcularPeriodo(nome: NomePeriodo, hoje = new Date()): Periodo {
  switch (nome) {
    case "hoje": {
      const inicio = inicioDoDia(hoje);
      const ontem = somarDias(inicio, -1);
      return {
        inicio,
        fim: fimDoDia(hoje),
        anterior: { inicio: ontem, fim: fimDoDia(ontem) },
        rotulo: "hoje",
        rotuloAnterior: "ontem",
      };
    }

    case "semana": {
      // Semana corrente começando no domingo.
      const inicio = inicioDoDia(somarDias(hoje, -hoje.getDay()));
      const inicioAnterior = somarDias(inicio, -7);
      return {
        inicio,
        fim: fimDoDia(hoje),
        anterior: { inicio: inicioAnterior, fim: fimDoDia(somarDias(inicio, -1)) },
        rotulo: "esta semana",
        rotuloAnterior: "semana passada",
      };
    }

    case "mes": {
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1, 0, 0, 0, 0);
      const inicioAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1, 0, 0, 0, 0);
      const fimAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 0, 23, 59, 59, 999);
      return {
        inicio,
        fim: fimDoDia(hoje),
        anterior: { inicio: inicioAnterior, fim: fimAnterior },
        rotulo: "este mês",
        rotuloAnterior: "mês passado",
      };
    }

    case "trimestre": {
      const inicio = inicioDoDia(somarDias(hoje, -89));
      const inicioAnterior = inicioDoDia(somarDias(inicio, -90));
      return {
        inicio,
        fim: fimDoDia(hoje),
        anterior: { inicio: inicioAnterior, fim: fimDoDia(somarDias(inicio, -1)) },
        rotulo: "últimos 3 meses",
        rotuloAnterior: "3 meses anteriores",
      };
    }

    case "tudo":
    default:
      return {
        inicio: new Date(2000, 0, 1),
        fim: fimDoDia(hoje),
        anterior: null,
        rotulo: "desde o início",
        rotuloAnterior: "",
      };
  }
}

/* -------------------------------------------------------------------------
 * Recorte de tempo do painel de pedidos.
 *
 * Separado do `calcularPeriodo` de propósito: lá o assunto é COMPARAR com o
 * período anterior; aqui é só peneirar a lista. E aqui existe o intervalo
 * escolhido a dedo, que as métricas não têm.
 * ------------------------------------------------------------------------- */

export type FiltroPeriodo = "sempre" | "hoje" | "semana" | "mes" | "escolhido";

/**
 * Vira "2026-08-10" (o que o campo de data devolve) em data do fuso DAQUI.
 *
 * `new Date("2026-08-10")` seria meia-noite em UTC, ou seja, 21h do dia 9 em
 * Brasília — o dia inteiro andaria pra trás. Já mordeu o prazo dos pedidos
 * uma vez (ver `lib/prazo.ts`), então aqui a data é montada campo a campo.
 */
function dataLocal(texto: string): Date | null {
  const [ano, mes, dia] = texto.split("-").map(Number);
  if (!ano || !mes || !dia) return null;
  return new Date(ano, mes - 1, dia);
}

/**
 * O intervalo que o filtro representa. `null` significa "não recorta nada" —
 * é o caso de "todo o período" e o de um intervalo escolhido pela metade.
 */
export function intervaloDoPeriodo(
  filtro: FiltroPeriodo,
  de = "",
  ate = "",
  hoje = new Date()
): { inicio: Date; fim: Date } | null {
  switch (filtro) {
    case "hoje":
      return { inicio: inicioDoDia(hoje), fim: fimDoDia(hoje) };

    case "semana":
      return { inicio: inicioDoDia(somarDias(hoje, -6)), fim: fimDoDia(hoje) };

    case "mes":
      return { inicio: inicioDoDia(somarDias(hoje, -29)), fim: fimDoDia(hoje) };

    case "escolhido": {
      const inicio = de ? dataLocal(de) : null;
      const fim = ate ? dataLocal(ate) : null;
      if (!inicio && !fim) return null;
      // Só uma ponta preenchida ainda vale: "de tal dia em diante".
      return {
        inicio: inicio ? inicioDoDia(inicio) : new Date(2000, 0, 1),
        fim: fim ? fimDoDia(fim) : fimDoDia(hoje),
      };
    }

    case "sempre":
    default:
      return null;
  }
}

/** A data cai dentro do recorte? Sem recorte, tudo cai. */
export function dentroDoPeriodo(
  quando: string | Date | null | undefined,
  intervalo: { inicio: Date; fim: Date } | null
): boolean {
  if (!intervalo) return true;
  if (!quando) return false;
  const t = new Date(quando).getTime();
  return t >= intervalo.inicio.getTime() && t <= intervalo.fim.getTime();
}

/**
 * Variação percentual entre dois números, para o indicador de subiu/caiu.
 * Devolve null quando não há base de comparação (antes era zero), porque
 * "aumentou infinito%" não diz nada a ninguém.
 */
export function variacao(atual: number, anterior: number): number | null {
  if (anterior === 0) return atual === 0 ? 0 : null;
  return ((atual - anterior) / anterior) * 100;
}
