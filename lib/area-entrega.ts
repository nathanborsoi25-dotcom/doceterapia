/**
 * Checagem de área atendida: a Doceterapia só vende para Arapongas-PR.
 * Endereços de fora são barrados no checkout (e também no servidor, em
 * /api/pagamento) — nesses casos o cliente é convidado a falar com a
 * Camily pelo WhatsApp pra combinar caso a caso.
 */

/**
 * Faixa de CEP de Arapongas-PR: 86700-000 a 86719-999.
 *
 * ⚠️ Já esteve errada, terminando em 86709-999, e isso **recusava clientes de
 * Arapongas**: o Jardim Vale do Coqueiral tem CEP 86715-602, e quem mora lá
 * ouvia do site que a loja não atende a região dele. Achado em 16/08/2026,
 * conferindo rua por rua com o ViaCEP — 86710-000, 86712-000 e 86715-602 são
 * todos Arapongas (IBGE 4101507); 86720-000 já é Sabáudia, e é isso que
 * fecha a faixa em cima.
 *
 * A cidade também precisa bater (ver abaixo), então esta faixa é a segunda
 * barreira, não a única.
 */
const CEP_MIN = 86_700_000;
const CEP_MAX = 86_719_999;

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // tira acentos
    .trim()
    .toLowerCase();
}

export type EnderecoArea = {
  cep?: string;
  cidade?: string;
  bairro?: string;
  rua?: string;
};

export type ResultadoArea = {
  atendido: boolean;
  /** Mensagem pronta pra mostrar ao cliente quando não for atendido. */
  motivo?: string;
};

/**
 * Diz se o endereço é de Arapongas-PR. Confere o CEP (quando informado) e a
 * cidade. Ambos precisam bater — CEP de outra cidade reprova mesmo que o
 * campo "cidade" diga Arapongas, e vice-versa.
 */
export function checarAreaEntrega(e: EnderecoArea): ResultadoArea {
  const cepDigitos = (e.cep ?? "").replace(/\D/g, "");

  if (cepDigitos.length === 8) {
    const cep = parseInt(cepDigitos, 10);
    if (cep < CEP_MIN || cep > CEP_MAX) {
      return {
        atendido: false,
        motivo: "O CEP informado não é de Arapongas-PR.",
      };
    }
  }

  const cidade = normalizar(e.cidade ?? "");
  if (cidade && cidade !== "arapongas") {
    return {
      atendido: false,
      motivo: "No momento entregamos somente em Arapongas-PR.",
    };
  }

  // Sem CEP válido e sem cidade não dá pra afirmar que é Arapongas.
  if (cepDigitos.length !== 8 && !cidade) {
    return {
      atendido: false,
      motivo: "Informe o CEP e a cidade para confirmarmos a entrega.",
    };
  }

  return { atendido: true };
}
