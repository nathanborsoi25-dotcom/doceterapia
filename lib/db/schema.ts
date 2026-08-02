import {
  pgTable,
  text,
  doublePrecision,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { Cliente, ConfiguracaoFrete, FaixaFrete, ItemPedido } from "../types";

// Catálogo de doces (gerenciado pelo admin, exibido no cardápio).
export const produtos = pgTable("produtos", {
  id: text("id").primaryKey(),
  nome: text("nome").notNull(),
  descricao: text("descricao").notNull().default(""),
  sabor: text("sabor").notNull().default(""),
  /**
   * Categoria do doce ("Tortas", "Bolos", "Docinhos de festa"...). É por ela
   * que o cardápio se organiza — vazio significa "sem categoria", e esses
   * doces aparecem juntos no fim.
   */
  categoria: text("categoria").notNull().default(""),
  preco: doublePrecision("preco").notNull().default(0),
  // Quanto custa PRODUZIR este doce (ingredientes + embalagem). É o que
  // permite calcular lucro de verdade nas métricas — sem isso só dá pra
  // mostrar faturamento. Zero significa "ainda não informado".
  custo: doublePrecision("custo").notNull().default(0),
  /**
   * Foto principal — a que aparece no cardápio. Continua existindo separada
   * de `fotos` porque todo doce já cadastrado tem esta preenchida, e o card
   * precisa saber qual mostrar sem depender de ordem de array.
   */
  fotoUrl: text("foto_url").notNull().default(""),
  /**
   * Até 3 fotos, na ordem em que a Camily quiser mostrar. A primeira é
   * sempre igual à `fotoUrl`. Vazio significa "só tem a principal".
   */
  fotos: jsonb("fotos").$type<string[]>().notNull().default([]),
  disponibilidade: text("disponibilidade").notNull().default("pronta_entrega"),
  prazoDias: integer("prazo_dias"),
  /**
   * Quantas unidades existem para vender agora.
   *
   * NULO significa "não controlo estoque deste doce" — é o caso do que é
   * feito sob encomenda, que a Camily faz na quantidade que pedirem. Zero é
   * diferente: quer dizer esgotado, e o doce aparece riscado no cardápio.
   */
  estoque: integer("estoque"),
  ativo: boolean("ativo").notNull().default(true),
  /** Quando o doce entrou no cardápio — serve pra ordenar o painel. */
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Recheios de um mesmo doce: a torta de Nutella, a de ninho, a de brigadeiro.
 *
 * Ficam numa tabela à parte (e não numa lista dentro do produto) porque cada
 * um tem estoque próprio: assim a venda de uma torta de Nutella desconta só
 * dela, com um UPDATE direto, sem reescrever a lista inteira e sem risco de
 * duas compras simultâneas se atropelarem.
 */
export const sabores = pgTable("sabores", {
  id: text("id").primaryKey(),
  produtoId: text("produto_id").notNull(),
  nome: text("nome").notNull(),
  /** Foto deste recheio. É ela que aparece quando a cliente toca no sabor. */
  fotoUrl: text("foto_url").notNull().default(""),
  /** Nulo = cobra o preço do doce. Preencher só quando o sabor custa outro valor. */
  preco: doublePrecision("preco"),
  /**
   * Quanto custa produzir ESTE recheio. Fica no sabor porque é aqui que a
   * diferença aparece: uma torta de Nutella gasta mais que uma de brigadeiro,
   * e sem isso o lucro das métricas sairia torto.
   */
  custo: doublePrecision("custo").notNull().default(0),
  /** Nulo = sem controle de estoque; zero = este sabor esgotou. */
  estoque: integer("estoque"),
  /**
   * "pronta_entrega" ou "sob_encomenda" — nulo herda do doce.
   *
   * Fica no recheio porque a realidade da cozinha é essa: a torta de Nutella
   * pode estar pronta na geladeira enquanto a de morango só sai por encomenda.
   */
  disponibilidade: text("disponibilidade"),
  /** Dias de preparo deste recheio, quando ele é sob encomenda. */
  prazoDias: integer("prazo_dias"),
  /** Ordem em que aparecem no cardápio. */
  ordem: integer("ordem").notNull().default(0),
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
  // Número do pagamento APROVADO dentro do Mercado Pago. O `external_reference`
  // que já tínhamos só faz o caminho contrário (do MP pra cá); pra mandar
  // estornar é este número que o MP pede. Fica nulo até o pagamento entrar.
  pagamentoId: text("pagamento_id"),
  // Cancelamento: quem cancelou ("cliente" ou "loja") e por quê.
  canceladoPor: text("cancelado_por"),
  motivoCancelamento: text("motivo_cancelamento"),
  canceladoEm: timestamp("cancelado_em", { withTimezone: true }),
  /**
   * Como ficou a devolução do dinheiro:
   *   "nao_precisa" — ninguém tinha pago ainda
   *   "concluido"   — o Mercado Pago aceitou o estorno
   *   "falhou"      — deu erro; a Camily precisa estornar na mão
   */
  statusReembolso: text("status_reembolso"),
  valorReembolsado: doublePrecision("valor_reembolsado"),
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

/**
 * Nota que o cliente dá para UM doce que comprou. É por doce, não por pedido:
 * quem levou brigadeiro e torta pode adorar um e não gostar do outro.
 *
 * O par (pedido, doce) é único — assim cada pessoa avalia cada doce uma vez
 * por compra, e não dá pra encher o cardápio de notas repetidas.
 */
export const avaliacoes = pgTable(
  "avaliacoes",
  {
    id: text("id").primaryKey(),
    produtoId: text("produto_id").notNull(),
    clienteId: text("cliente_id").notNull(),
    pedidoId: text("pedido_id").notNull(),
    /** De 1 a 5. */
    nota: integer("nota").notNull(),
    comentario: text("comentario").notNull().default(""),
    /**
     * A avaliação nasce visível (publica na hora). A Camily pode esconder uma
     * que seja abusiva — e a escondida também sai do cálculo da média.
     */
    visivel: boolean("visivel").notNull().default(true),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    umaPorDocePorPedido: uniqueIndex("avaliacoes_pedido_produto_idx").on(
      t.pedidoId,
      t.produtoId
    ),
  })
);

/**
 * Print do story que a cliente postou marcando a loja, esperando aprovação.
 *
 * Por que print e não integração com o Instagram: a API deles só enxerga
 * story de perfil PÚBLICO que marque com @, e ainda exige revisão da Meta.
 * Metade das clientes ficaria de fora reclamando que postou e não ganhou.
 * Com o print, a Camily aprova em um clique e ainda vê o story pra repostar.
 *
 * Um por pedido — é o que amarra a recompensa a uma compra de verdade.
 */
export const stories = pgTable(
  "stories",
  {
    id: text("id").primaryKey(),
    clienteId: text("cliente_id").notNull(),
    pedidoId: text("pedido_id").notNull(),
    /** Print enviado pela cliente, guardado no Vercel Blob. */
    imagemUrl: text("imagem_url").notNull(),
    /** @ da pessoa no Instagram, pra Camily achar o story e repostar. */
    arroba: text("arroba").notNull().default(""),
    /** "pendente" | "aprovado" | "recusado" */
    situacao: text("situacao").notNull().default("pendente"),
    pontosCreditados: integer("pontos_creditados").notNull().default(0),
    motivoRecusa: text("motivo_recusa"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    decididoEm: timestamp("decidido_em", { withTimezone: true }),
  },
  (t) => ({
    umPorPedido: uniqueIndex("stories_pedido_idx").on(t.pedidoId),
  })
);

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
  /** Pontos ganhos ao postar o doce nos stories (depois da Camily aprovar). */
  pontosPorStory: integer("pontos_por_story").notNull().default(15),
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
