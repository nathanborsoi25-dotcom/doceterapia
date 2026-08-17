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

/**
 * Telefone brasileiro com DDD (10 ou 11 dígitos), aceitando o **+55** que o
 * preenchimento automático do navegador costuma mandar junto.
 *
 * ⚠️ Recusar o número com o código do país era metade do problema: a máscara
 * cortava os dois últimos dígitos e o cadastro salvava um telefone que não
 * existe. Aqui e na máscara (`digitosDeTelefone`) a leitura passou a ser a
 * mesma — quem valida e quem formata não podem discordar.
 */
export function telefoneValido(telefone: string): boolean {
  const d = normalizarTelefone(telefone);
  return d.length === 10 || d.length === 11;
}

/**
 * O telefone como ele deve ser GRAVADO: só os dígitos do número brasileiro,
 * sem o código do país. É o que o servidor usa antes de salvar, porque o que
 * chega do navegador pode vir com "+55", espaço, traço e parêntese.
 */
export function normalizarTelefone(telefone: string): string {
  const d = apenasDigitos(telefone);
  // Só tira o 55 quando sobra número demais: DDD 55 existe (Santa Maria-RS),
  // e "(55) 99999-9999" tem 11 dígitos legítimos.
  //
  // ⚠️ E NÃO corta o que sobrar: cortar aqui faria um número absurdo de 15
  // dígitos virar 11 e passar na validação como se fosse telefone de gente.
  // Quem limita o tamanho é a máscara, enquanto a pessoa digita.
  return (d.length === 12 || d.length === 13) && d.startsWith("55") ? d.slice(2) : d;
}
