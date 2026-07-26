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
  formaPagamento: text("forma_pagamento").notNull(),
  status: text("status").notNull().default("aguardando_pagamento"),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
});

// Configuração de frete — sempre uma única linha (id fixo "default").
export const configFrete = pgTable("config_frete", {
  id: text("id").primaryKey(),
  origem: jsonb("origem").$type<ConfiguracaoFrete["origem"]>().notNull(),
  faixas: jsonb("faixas").$type<FaixaFrete[]>().notNull(),
});
