/** Validações compartilhadas entre o formulário na tela e as rotas /api. */

/** Deixa só os dígitos (telefone e CEP chegam com parênteses, traços, etc.). */
export function apenasDigitos(valor: string): string {
  return (valor ?? "").replace(/\D/g, "");
}

/**
 * Como o e-mail é gravado e comparado: sem espaços nas pontas e em
 * minúsculas. É o que faz "Fulano@Gmail.com " e "fulano@gmail.com" caírem na
 * MESMA conta — se cada tela normalizasse do seu jeito, a pessoa criaria
 * cadastro duplicado sem entender o porquê.
 */
export function normalizarEmail(email: string): string {
  return (email ?? "").trim().toLowerCase();
}

/** Checagem de e-mail simples: algo@algo.algo, sem espaços. */
export function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizarEmail(email));
}

/** Telefone brasileiro com DDD (10 ou 11 dígitos). */
export function telefoneValido(telefone: string): boolean {
  const d = apenasDigitos(telefone);
  return d.length === 10 || d.length === 11;
}
