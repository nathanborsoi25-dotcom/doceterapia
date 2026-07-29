/** Validações compartilhadas entre o formulário na tela e as rotas /api. */

/** Deixa só os dígitos (CPF e telefone chegam com pontos, traços, etc.). */
export function apenasDigitos(valor: string): string {
  return (valor ?? "").replace(/\D/g, "");
}

/** Confere os dígitos verificadores do CPF, não só o tamanho. */
export function cpfValido(cpf: string): boolean {
  const d = apenasDigitos(cpf);
  if (d.length !== 11) return false;
  // Rejeita 000.000.000-00, 111.111.111-11, etc.
  if (/^(\d)\1{10}$/.test(d)) return false;

  for (const [tamanho, posicaoDV] of [
    [9, 9],
    [10, 10],
  ] as const) {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(d[i]) * (tamanho + 1 - i);
    let dv = (soma * 10) % 11;
    if (dv === 10) dv = 0;
    if (dv !== Number(d[posicaoDV])) return false;
  }
  return true;
}

/** Checagem de e-mail simples: algo@algo.algo, sem espaços. */
export function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((email ?? "").trim());
}

/** Telefone brasileiro com DDD (10 ou 11 dígitos). */
export function telefoneValido(telefone: string): boolean {
  const d = apenasDigitos(telefone);
  return d.length === 10 || d.length === 11;
}
