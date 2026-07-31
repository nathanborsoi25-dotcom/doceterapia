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

/**
 * Variação percentual entre dois números, para o indicador de subiu/caiu.
 * Devolve null quando não há base de comparação (antes era zero), porque
 * "aumentou infinito%" não diz nada a ninguém.
 */
export function variacao(atual: number, anterior: number): number | null {
  if (anterior === 0) return atual === 0 ? 0 : null;
  return ((atual - anterior) / anterior) * 100;
}
