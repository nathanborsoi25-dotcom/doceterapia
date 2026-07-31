import {
  pgTable,
  text,
  doublePrecision,
  integer,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import type { Cliente, ConfiguracaoFrete, FaixaFrete, ItemPedido } from "../types";

// Catálogo de doces (gerenciado pelo admin, exibido no cardápio).
export const produtos = pgTable("produtos", {
  id: text("id").primaryKey(),
  nome: text("nome").notNull(),
  descricao: text("descricao").notNull().default(""),
  sabor: text("sabor").notNull().default(""),
  preco: doublePrecision("preco").notNull().default(0),
  // Quanto custa PRODUZIR este doce (ingredientes + embalagem). É o que
  // permite calcular lucro de verdade nas métricas — sem isso só dá pra
  // mostrar faturamento. Zero significa "ainda não informado".
  custo: doublePrecision("custo").notNull().default(0),
  fotoUrl: text("foto_url").notNull().default(""),
  disponibilidade: text("disponibilidade").notNull().default("pronta_entrega"),
  prazoDias: integer("prazo_dias"),
  ativo: boolean("ativo").notNull().default(true),
});

// Clientes cadastrados (cada CPF é único).
export const clientes = pgTable("clientes", {
  id: text("id").primaryKey(),
  nome: text("nome").notNull(),
  cpf: text("cpf").notNull().unique(),
  // E-mail é para onde vai o código de "esqueci minha senha", então é ele
  // que protege a conta (o CPF não serve: circula em nota fiscal e vazamentos).
  email: text("email").notNull().default(""),
  // Senha do cliente, guardada como hash scrypt (nunca em texto puro).
  // Aceita nulo por causa de quem se cadastrou antes de existir login.
  senhaHash: text("senha_hash"),
  telefone: text("telefone").notNull().default(""),
  rua: text("rua").notNull().default(""),
  numero: text("numero").notNull().default(""),
  bairro: text("bairro").notNull().default(""),
  cidade: text("cidade").notNull().default(""),
  cep: text("cep").notNull().default(""),
  complemento: text("complemento"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
});

// Pedidos feitos no checkout.
export const pedidos = pgTable("pedidos", {
  id: text("id").primaryKey(),
  clienteId: text("cliente_id"),
  itens: jsonb("itens").$type<ItemPedido[]>().notNull(),
  tipoEntrega: text("tipo_entrega").notNull(),
  dataAgendada: text("data_agendada").notNull().default(""),
  enderecoEntrega: jsonb("endereco_entrega").$type<Cliente["endereco"] | null>(),
  valorFrete: doublePrecision("valor_frete").notNull().default(0),
  /** Cupom aplicado na compra, se houve. */
  cupomCodigo: text("cupom_codigo"),
  desconto: doublePrecision("desconto").notNull().default(0),
  formaPagamento: text("forma_pagamento").notNull(),
  status: text("status").notNull().default("aguardando_pagamento"),
  // Quando este pedido precisa estar pronto. Calculado no servidor na hora
  // da compra: na retirada é a data agendada; na entrega é a data do pedido
  // mais o maior prazo de encomenda entre os doces do carrinho. Guardar o
  // resultado (em vez de recalcular) mantém o prazo estável mesmo que a
  // Camily mude o prazo do produto depois.
  prazoEm: timestamp("prazo_em", { withTimezone: true }),
  // Link de acompanhamento da entrega (o que o Uber Envios gera). A Camily
  // cola aqui ao despachar, e ele vai junto no e-mail de "saiu para entrega".
  linkRastreio: text("link_rastreio"),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Carrinho de cada cliente, guardado no banco além do navegador. Serve pra
 * duas coisas: o carrinho seguir a pessoa entre o celular e o computador, e
 * a Camily enxergar quem encheu o carrinho e não finalizou a compra.
 * Uma linha por cliente — o carrinho é sempre "o atual".
 */
export const carrinhos = pgTable("carrinhos", {
  clienteId: text("cliente_id").primaryKey(),
  itens: jsonb("itens").$type<ItemPedido[]>().notNull(),
  atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Códigos de uso único para redefinir a senha ("esqueci minha senha").
// O código também fica como hash: se alguém vazar a tabela, não dá pra usar.
export const codigosSenha = pgTable("codigos_senha", {
  id: text("id").primaryKey(),
  clienteId: text("cliente_id").notNull(),
  codigoHash: text("codigo_hash").notNull(),
  expiraEm: timestamp("expira_em", { withTimezone: true }).notNull(),
  usadoEm: timestamp("usado_em", { withTimezone: true }),
  tentativas: integer("tentativas").notNull().default(0),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Cupons de desconto criados pela Camily. Um cupom pode valer para a loja
 * toda (clienteId nulo) ou ser exclusivo de uma pessoa — inclusive como
 * isca para trazer de volta quem abandonou o carrinho.
 */
export const cupons = pgTable("cupons", {
  id: text("id").primaryKey(),
  /** O que o cliente digita. Guardado em MAIÚSCULAS para não haver dúvida. */
  codigo: text("codigo").notNull().unique(),
  descricao: text("descricao").notNull().default(""),
  /** "percentual" (10% off) ou "valor" (R$ 10 off). */
  tipo: text("tipo").notNull().default("percentual"),
  valor: doublePrecision("valor").notNull().default(0),
  /** Só vale a partir deste subtotal. Zero = sem mínimo. */
  pedidoMinimo: doublePrecision("pedido_minimo").notNull().default(0),
  /** Nulo = qualquer cliente pode usar. */
  clienteId: text("cliente_id"),
  /** Nulo = sem prazo. */
  expiraEm: timestamp("expira_em", { withTimezone: true }),
  /** Zero = uso ilimitado. */
  limiteUsos: integer("limite_usos").notNull().default(0),
  usos: integer("usos").notNull().default(0),
  ativo: boolean("ativo").notNull().default(true),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Extrato de pontos de fidelidade. Em vez de guardar só um saldo, guardamos
 * cada movimento: assim dá pra mostrar ao cliente de onde vieram os pontos e
 * o saldo é sempre a soma — nunca "desafina".
 */
export const pontos = pgTable("pontos", {
  id: text("id").primaryKey(),
  clienteId: text("cliente_id").notNull(),
  /** Positivo quando ganha, negativo quando resgata. */
  quantidade: integer("quantidade").notNull(),
  /** "pedido", "avaliacao" ou "resgate". */
  motivo: text("motivo").notNull(),
  descricao: text("descricao").notNull().default(""),
  /** Pedido que gerou os pontos, quando houver. */
  pedidoId: text("pedido_id"),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
});

/** O que o cliente pode trocar pelos pontos. */
export const recompensas = pgTable("recompensas", {
  id: text("id").primaryKey(),
  nome: text("nome").notNull(),
  descricao: text("descricao").notNull().default(""),
  pontos: integer("pontos").notNull().default(0),
  ativo: boolean("ativo").notNull().default(true),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Ajustes gerais da loja — uma única linha (id "default"). Guarda as regras
 * de pontuação e o banner de promoção da página inicial, pra Camily mudar
 * tudo pelo painel sem precisar de programador.
 */
export const configLoja = pgTable("config_loja", {
  id: text("id").primaryKey(),
  /** Pontos ganhos por real gasto (ex: 1 ponto por R$ 1,00). */
  pontosPorReal: doublePrecision("pontos_por_real").notNull().default(1),
  /** Pontos ganhos ao avaliar um doce. */
  pontosPorAvaliacao: integer("pontos_por_avaliacao").notNull().default(10),
  bannerAtivo: boolean("banner_ativo").notNull().default(false),
  bannerTitulo: text("banner_titulo").notNull().default(""),
  bannerDescricao: text("banner_descricao").notNull().default(""),
  bannerSelo: text("banner_selo").notNull().default(""),
  bannerImagem: text("banner_imagem").notNull().default(""),
  /** Para onde o banner leva (ex: /catalogo). */
  bannerLink: text("banner_link").notNull().default("/catalogo"),
});

// Configuração de frete — sempre uma única linha (id fixo "default").
export const configFrete = pgTable("config_frete", {
  id: text("id").primaryKey(),
  origem: jsonb("origem").$type<ConfiguracaoFrete["origem"]>().notNull(),
  faixas: jsonb("faixas").$type<FaixaFrete[]>().notNull(),
});
