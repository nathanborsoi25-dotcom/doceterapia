export type TipoDisponibilidade = "pronta_entrega" | "sob_encomenda";

export interface Produto {
  id: string;
  nome: string;
  descricao: string;
  sabor: string;
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
}

export interface Cliente {
  id: string;
  nome: string;
  cpf: string;
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
export type FormaPagamento = "pix" | "credito" | "debito";

export interface ItemPedido {
  produtoId: string;
  nome: string;
  precoUnitario: number;
  quantidade: number;
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
  dataAgendada: string;
  enderecoEntrega?: Cliente["endereco"];
  valorFrete: number;
  formaPagamento: FormaPagamento;
  status: StatusPedido;
  criadoEm: string;
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
  clienteNome: string | null;
  clienteTelefone: string | null;
  /** Devolução do dinheiro: "nao_precisa" | "concluido" | "falhou" | null. */
  statusReembolso: string | null;
  valorReembolsado: number | null;
  /** Quem cancelou: "cliente" | "loja" | null. */
  canceladoPor: string | null;
  motivoCancelamento: string | null;
}

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
