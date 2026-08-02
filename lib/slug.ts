/**
 * Endereço bonito do doce: `/doce/torta-de-cookie-nutella--p2`.
 *
 * O id vai no fim, depois de dois hífens, por dois motivos: o link fica
 * legível pra quem recebe no story ("torta de cookie" dá pra ler na barra do
 * navegador) e a busca continua sendo pelo id, que nunca muda — se a Camily
 * renomear o doce, o link antigo continua abrindo o doce certo.
 *
 * O separador é DUPLO porque o id pode ter hífen dentro (é um uuid).
 */

const SEPARADOR = "--";

/** Marcas de acento que sobram depois do normalize("NFD"). */
const ACENTOS = /[̀-ͯ]/g;

export function slugDoProduto(produto: { id: string; nome: string }): string {
  const nome = (produto.nome ?? "")
    .normalize("NFD")
    .replace(ACENTOS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // tudo que não é letra/número vira hífen
    .replace(/^-+|-+$/g, "") // sem hífen sobrando nas pontas
    .slice(0, 60);

  return nome ? `${nome}${SEPARADOR}${produto.id}` : produto.id;
}

/** Tira o id de volta do endereço. Aceita link antigo que só tinha o id. */
export function idDoSlug(slug: string): string {
  const texto = decodeURIComponent(slug ?? "");
  const corte = texto.indexOf(SEPARADOR);
  return corte === -1 ? texto : texto.slice(corte + SEPARADOR.length);
}
