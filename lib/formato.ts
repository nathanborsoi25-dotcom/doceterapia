/** Máscaras de digitação, para os campos ficarem legíveis enquanto o cliente escreve. */

/**
 * Os dígitos de um telefone brasileiro, sem o código do país.
 *
 * ⚠️ **O preenchimento automático do navegador manda o número com o +55**, e
 * era aí que o cadastro estragava: "+55 43 99634-7895" tem 13 dígitos, o corte
 * em 11 jogava fora os DOIS ÚLTIMOS e ainda promovia o 55 a DDD — a cliente
 * ficava salva como "(55) 43996-3478", um número que não existe. Aconteceu de
 * verdade com uma cliente nova.
 *
 * O 55 só é tirado quando sobra telefone demais (12 ou 13 dígitos), nunca com
 * 10 ou 11: **DDD 55 existe** (Santa Maria-RS), e "(55) 99999-9999" é um
 * celular legítimo que não pode virar "(99) 9999-9999".
 */
export function digitosDeTelefone(valor: string): string {
  const d = (valor ?? "").replace(/\D/g, "");
  const semPais = (d.length === 12 || d.length === 13) && d.startsWith("55") ? d.slice(2) : d;
  return semPais.slice(0, 11);
}

/** (43) 99999-9999 */
export function formatarTelefone(valor: string): string {
  const d = digitosDeTelefone(valor);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** 00000-000 */
export function formatarCep(valor: string): string {
  const d = (valor ?? "").replace(/\D/g, "").slice(0, 8);
  return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`;
}

/* ---------------------------------------------------------------------------
 * Campos de número (preço, custo, frete, pontos)
 *
 * Aqui a gente digita "6,50" — com vírgula. O <input type="number"> do
 * navegador entrega texto VAZIO quando o conteúdo não é um número válido pra
 * ele, e é isso que fazia o campo "comer" o que estava sendo escrito na hora
 * da vírgula. Por isso os campos de número do painel são de texto e passam
 * por estas funções.
 * ------------------------------------------------------------------------- */

/**
 * Arruma o que a pessoa acabou de digitar: joga fora letra e símbolo, aceita
 * ponto como se fosse vírgula e mantém no máximo `casas` decimais.
 *
 * Deixa passar de propósito o campo vazio e o número terminando em vírgula
 * ("12,") — são estados normais no meio da digitação. Se convertêssemos pra
 * número já nessa hora, apagar tudo viraria zero e a vírgula sumiria.
 */
export function limparNumeroDigitado(entrada: string, casas = 2): string {
  const so = (entrada ?? "").replace(/[^\d.,]/g, "").replace(/\./g, ",");
  const [inteiro = "", ...resto] = so.split(",");
  if (casas <= 0 || resto.length === 0) return inteiro;
  return `${inteiro},${resto.join("").slice(0, casas)}`;
}

/** Texto do campo → número. Campo vazio vira `null` (e não zero). */
export function numeroDigitado(texto: string): number | null {
  const limpo = (texto ?? "").replace(",", ".");
  if (!limpo || limpo === ".") return null;
  const n = Number.parseFloat(limpo);
  return Number.isFinite(n) ? n : null;
}

/** Número → texto do campo, com vírgula. */
export function numeroParaCampo(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return "";
  return String(valor).replace(".", ",");
}

/** R$ 6,50 */
export function reais(valor: number): string {
  return `R$ ${(Number(valor) || 0).toFixed(2).replace(".", ",")}`;
}
