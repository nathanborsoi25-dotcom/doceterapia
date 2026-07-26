export type TipoDisponibilidade = "pronta_entrega" | "sob_encomenda";

export interface Produto {
  id: string;
  nome: string;
  descricao: string;
  sabor: string;
  preco: number; // em reais
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

export interface Pedido {
  id: string;
  clienteId: string;
  itens: ItemPedido[];
  tipoEntrega: TipoEntrega;
  dataAgendada: string; // ISO date - data/horário agendado para entrega OU retirada
  enderecoEntrega?: Cliente["endereco"];
  valorFrete: number;
  formaPagamento: FormaPagamento;
  status: "aguardando_pagamento" | "pago" | "em_preparo" | "a_caminho" | "concluido" | "cancelado";
  criadoEm: string;
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
