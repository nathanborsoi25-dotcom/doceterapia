export type TipoDisponibilidade = "pronta_entrega" | "sob_encomenda";

export interface Produto {
  id: string;
  nome: string;
  descricao: string;
  sabor: string;
  /** Como o cardápio agrupa os doces. Vazio = sem categoria. */
  categoria?: string;
  /** Quando entrou no cardápio (ISO). Usado pra ordenar o painel. */
  criadoEm?: string;
  preco: number; // em reais
  /** Quanto custa produzir (ingredientes + embalagem). Alimenta o lucro. */
  custo?: number;
  /** Foto principal, a que vai pro cardápio. */
  fotoUrl: string;
  /** Até 3 fotos do doce, começando pela principal. */
  fotos?: string[];
  disponibilidade: TipoDisponibilidade;
  prazoDias?: number; // usado quando "sob_encomenda"
  /** Unidades disponíveis. `null` = sem controle de estoque; 0 = esgotado. */
  estoque?: number | null;
  ativo: boolean;
  /** Média das notas dos clientes (0 quando ninguém avaliou ainda). */
  notaMedia?: number;
  totalAvaliacoes?: number;
  /** Recheios deste doce. Vazio = doce de sabor único. */
  sabores?: SaborDoDoce[];
}

/**
 * Um recheio do doce. Preço e estoque nulos querem dizer "segue o doce" e
 * "sem controle" — quem resolve isso é `lib/sabores.ts`, num lugar só.
 */
export interface SaborDoDoce {
  id: string;
  produtoId: string;
  nome: string;
  fotoUrl: string;
  preco?: number | null;
  /** Quanto custa produzir este recheio (alimenta o lucro). */
  custo?: number;
  estoque?: number | null;
  /** Nulo = segue o doce. */
  disponibilidade?: TipoDisponibilidade | null;
  prazoDias?: number | null;
  ordem: number;
  ativo: boolean;
}

export interface Cliente {
  id: string;
  nome: string;
  /** É com ele que a pessoa entra no site. Sempre em minúsculas. */
  email: string;
  endereco: {
    rua: string;
    numero: string;
    bairro: string;
    cidade: string;
    cep: string;
    complemento?: string;
    // coordenadas usadas para calcular a distância do frete
    lat?: number;
    lng?: number;
  };
  telefone: string;
  criadoEm: string;
}

export type TipoEntrega = "entrega" | "retirada";
/**
 * O checkout só oferece Pix e crédito — o Mercado Pago não tem débito no
 * Checkout Pro. O `"debito"` continua aqui porque pedidos antigos foram
 * gravados com ele e o painel precisa saber ler.
 */
export type FormaPagamento = "pix" | "credito" | "debito";

export interface ItemPedido {
  produtoId: string;
  nome: string;
  precoUnitario: number;
  quantidade: number;
  /**
   * Recheio escolhido, quando o doce tem sabores. O nome vai junto porque o
   * pedido precisa continuar legível anos depois, mesmo que o sabor seja
   * renomeado ou saia do cardápio — é o que a Camily lê para produzir.
   */
  saborId?: string;
  saborNome?: string;
}

export type StatusPedido =
  | "aguardando_pagamento"
  | "pago"
  | "em_preparo"
  | "a_caminho"
  | "concluido"
  | "cancelado";

export interface Pedido {
  id: string;
  clienteId: string;
  itens: ItemPedido[];
  tipoEntrega: TipoEntrega;
  /** Data/hora escolhida pelo cliente — só existe na RETIRADA. */
  /** Só nos pedidos antigos, de quando a retirada era agendada no site. */
  dataAgendada: string;
  /** Onde a cliente vai buscar (endereço + horários), quando é retirada. */
  pontoRetirada?: string | null;
  enderecoEntrega?: Cliente["endereco"];
  valorFrete: number;
  formaPagamento: FormaPagamento;
  status: StatusPedido;
  criadoEm: string;
  /** Compra para outra pessoa: quem recebe e o recado que vai junto. */
  ehPresente?: boolean;
  nomeQuemRecebe?: string | null;
  bilhete?: string | null;
}

/**
 * O pedido como o painel da Camily precisa ver: com o prazo calculado e os
 * dados do cliente já resolvidos, pra ela chamar no WhatsApp na hora.
 */
export interface PedidoDoPainel extends Pedido {
  /** Quando precisa estar pronto (ISO), ou null em pedidos antigos. */
  prazoEm: string | null;
  /** Link de acompanhamento da entrega, quando informado. */
  linkRastreio: string | null;
  /** Cupom usado e quanto ele abateu. */
  cupomCodigo: string | null;
  desconto: number;
  /** Abatimento por ter pago no Pix, em reais. */
  descontoPix: number;
  clienteNome: string | null;
  clienteTelefone: string | null;
  /** Devolução do dinheiro: "nao_precisa" | "concluido" | "falhou" | null. */
  statusReembolso: string | null;
  valorReembolsado: number | null;
  /** Quem cancelou: "cliente" | "loja" | null. */
  canceladoPor: string | null;
  motivoCancelamento: string | null;
}

/** Endereço de entrega informado só para aquele pedido. */
export type EnderecoDoPedido = Cliente["endereco"];

/**
 * O pedido como o próprio cliente vê na conta dele: sem os dados internos da
 * loja, e já com as respostas de "posso cancelar?" e "posso avaliar?"
 * decididas no servidor — a tela não precisa (nem deve) refazer essa conta.
 */
export interface PedidoDoCliente extends Pedido {
  prazoEm: string | null;
  linkRastreio: string | null;
  cupomCodigo: string | null;
  desconto: number;
  /** Abatimento por ter pago no Pix, em reais. */
  descontoPix: number;
  podeCancelar: boolean;
  statusReembolso: string | null;
  podeAvaliar: boolean;
  /** Ids dos doces deste pedido que ele já avaliou. */
  avaliados: string[];
}

/** Print de story que a cliente mandou, esperando a Camily aprovar. */
export interface StoryEnviado {
  id: string;
  pedidoId: string;
  situacao: "pendente" | "aprovado" | "recusado";
  pontosCreditados: number;
  motivoRecusa?: string | null;
  criadoEm: string;
  /** Só o painel recebe estes campos. */
  imagemUrl?: string;
  arroba?: string;
  clienteNome?: string;
  clienteTelefone?: string | null;
}

/** Nota que um cliente deu para um doce. */
export interface Avaliacao {
  id: string;
  produtoId: string;
  pedidoId: string;
  nota: number;
  comentario: string;
  criadoEm: string;
  /** Primeiro nome de quem avaliou — o resto não aparece pra ninguém. */
  clienteNome: string;
  /** Só o painel recebe este campo. */
  visivel?: boolean;
  produtoNome?: string;
}

// Faixa de frete configurável pelo admin, por distância (em km) a partir
// do endereço de origem da loja.
export interface FaixaFrete {
  id: string;
  distanciaMinKm: number;
  distanciaMaxKm: number;
  valor: number;
}

export interface ConfiguracaoFrete {
  origem: {
    endereco: string; // ex: "Rua Ajaja, 41 - Arapongas, PR"
    lat: number;
    lng: number;
  };
  faixas: FaixaFrete[];
}
