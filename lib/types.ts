export type TipoDisponibilidade = "pronta_entrega" | "sob_encomenda";

export interface Produto {
  id: string;
  nome: string;
  descricao: string;
  sabor: string;
  preco: number; // em reais
  /** Quanto custa produzir (ingredientes + embalagem). Alimenta o lucro. */
  custo?: number;
  fotoUrl: string;
  disponibilidade: TipoDisponibilidade;
  prazoDias?: number; // usado quando "sob_encomenda"
  ativo: boolean;
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
