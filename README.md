# Doceterapia

Loja online da Camily Vilasboa — doces artesanais em Arapongas, PR.

No ar em **[doceterapia.net.br](https://doceterapia.net.br)**, hospedado na Vercel.

O site vende de verdade: a cliente monta o carrinho, paga pelo Mercado Pago, recebe
os avisos por e-mail e acompanha o pedido pela conta dela. A Camily administra tudo
por um painel próprio, sem precisar de programador para o dia a dia.

---

## Como está montado

| Camada | O que usamos |
| --- | --- |
| Framework | Next.js 14 (App Router) + React 18 |
| Linguagem | TypeScript |
| Estilo | Tailwind CSS (paleta cereja/rosa, tipografia Fraunces + Nunito) |
| Banco | Neon Postgres, acessado com Drizzle ORM (`@neondatabase/serverless`) |
| Fotos | Vercel Blob |
| Pagamento | Mercado Pago (Checkout Pro) |
| E-mail | Resend |
| CEP / mapa | ViaCEP (endereço) e Nominatim/OpenStreetMap (coordenadas) |
| Hospedagem | Vercel |

Nada de `localStorage` como banco: **todos os dados moram no Neon Postgres**. O
navegador só guarda o carrinho enquanto ele é rascunho — e mesmo esse é copiado
para o banco assim que a pessoa entra na conta.

---

## O que a cliente vê

- **Cardápio aberto.** A home (`/`) manda direto para `/catalogo` — dá para olhar
  tudo, montar carrinho e ver o frete sem criar conta. A conta só é exigida na
  hora de pagar.
- **Categorias** ("Tortas", "Bolos", "Docinhos de festa"…) organizam o cardápio,
  na ordem que a Camily definir.
- **Página do doce** com até 3 fotos, descrição e escolha de quantidade. Aberta de
  dentro do cardápio ela vira uma gaveta (rota paralela `app/@gaveta` com
  interceptação), sem perder o lugar na lista.
- **Recheios**: um mesmo doce pode ter vários (Nutella, ninho, brigadeiro), cada um
  com foto, preço, custo, estoque, disponibilidade e prazo próprios.
- **Estoque** por doce ou por recheio. Sem valor = não se controla estoque; zero =
  esgotado, e o doce aparece marcado assim no cardápio.
- **Conta do cliente** (`/conta`) em três abas: meus pedidos, pontos e cupons,
  meus dados.
- **Checkout** com entrega ou retirada agendada, cupom de desconto, opção de
  presente (nome de quem recebe + bilhete que a Camily copia à mão no cartão) e
  entrega em endereço diferente do cadastro.
- **Avaliações** de 1 a 5 estrelas com comentário, uma por doce por pedido.
- **Fidelidade**: pontos por real gasto, por avaliação e por story aprovado,
  trocáveis por recompensas.
- **Cancelamento** pelo próprio site, com pedido de estorno automático no
  Mercado Pago.

### Login e cadastro

A identidade da conta é o **e-mail** — é com ele que a pessoa entra e é para ele que
vai o código de "esqueci minha senha". O CPF **não** é mais pedido: a loja não
precisa dele para vender nem para entregar, e guardar documento à toa só cria risco.

- Cadastro: nome, e-mail, telefone, endereço e senha.
- Senha guardada como hash **scrypt**, nunca em texto puro.
- Recuperação de senha: código de uso único, válido por 15 minutos, enviado por
  e-mail. O código também fica gravado como hash.
- As respostas de login e de recuperação são sempre iguais, exista a conta ou não —
  assim ninguém descobre quem tem cadastro aqui só testando endereços.

### Entrega e frete

- A entrega cobre **apenas Arapongas-PR** (confere o CEP na faixa 86700-000 a
  86709-999 **e** o nome da cidade). Quem é de fora ainda compra escolhendo
  Retirada, ou fala com a Camily pelo WhatsApp.
- O valor sai de uma **tabela de faixas de distância**, calculada em linha reta
  (fórmula de Haversine) entre a loja e o endereço. As faixas foram calibradas com
  recibos reais do Uber Envios e são editáveis no painel, sem mexer no código.
- O CEP preenche o endereço sozinho (ViaCEP) e as coordenadas vêm da geocodificação
  no servidor (Nominatim/OpenStreetMap, gratuito e sem chave).

### Pagamento

Checkout Pro do Mercado Pago, com **Pix e crédito à vista** (boleto foi removido
de propósito; o débito não existe no Checkout Pro, só na maquininha e no Tap, e
por isso saiu da tela). O pedido nasce como `aguardando_pagamento` e o
**webhook** (`/api/pagamento/webhook`) atualiza a situação quando o Mercado Pago
avisa — buscando o pagamento na API deles, nunca confiando no que veio no corpo
da chamada.

Situações do pedido: `aguardando_pagamento` → `pago` → `em_preparo` → `a_caminho` →
`concluido`, além de `cancelado`.

### E-mails

Enviados pelo Resend (chamada HTTP direta à API, sem SDK), com a moldura visual da
loja:

- código para redefinir a senha;
- aviso a cada mudança de situação do pedido, incluindo o link de acompanhamento da
  entrega quando a Camily informa, e o que aconteceu com o dinheiro em caso de
  cancelamento.

---

## O que a Camily vê (painel `/admin`)

| Tela | Para quê |
| --- | --- |
| Meus pedidos | Ver e acompanhar os pedidos recebidos |
| Meus números | Vendas, faturamento, lucro e mais vendidos |
| Avaliações | O que os clientes acharam de cada doce (e esconder abuso) |
| Stories | Aprovar quem postou o doce e liberar os pontos |
| Promoções | Cupons de desconto e banner de destaque do cardápio |
| Fidelidade | Pontos por compra e prêmios para resgate |
| Meus produtos | Editar fotos, título, descrição, preço, custo e estoque |
| Categorias | Criar, renomear e ordenar as seções do cardápio |
| Adicionar produto | Cadastrar um novo doce no cardápio |
| Configurar frete | Faixas de distância e valores |
| Meus clientes | Quem já fez cadastro no site |

O painel também mostra **carrinhos abandonados** e permite falar com o cliente pelo
WhatsApp em um clique.

**Acesso:** senha única (`ADMIN_PASSWORD`) trocada por um cookie `httpOnly`
assinado com HMAC-SHA256 (`ADMIN_SESSION_SECRET`). O `middleware.ts` tranca as
telas `/admin`, e cada rota de API sensível chama `requireAdmin()` por conta
própria — a trava dos dados não depende do middleware.

**Fotos:** upload direto pelo celular ou pelo computador, até 8 MB, em JPG, PNG,
WEBP, GIF ou HEIC/HEIF. Vão para o Vercel Blob e o produto guarda só o endereço
público da imagem.

---

## Decisões de segurança que valem conhecer

Antes de mexer no checkout, saiba que **nada que vem do navegador é levado a sério**:

- Os itens do pedido são remontados a partir do banco. Só `produtoId`, `saborId` e
  `quantidade` são aproveitados — nome e preço vindos da tela são descartados,
  senão dava para comprar uma torta de R$ 65 por R$ 1.
- O **frete é recalculado no servidor**, com as coordenadas e as faixas do banco.
- O **desconto do cupom** é reavaliado no servidor, contra a regra gravada.
- **Quem está comprando sai da sessão**, não do corpo da requisição.
- O **estoque é conferido no servidor** na hora de pagar: entre montar o carrinho e
  clicar em pagar, o último doce pode ter sido vendido para outra pessoa.
- Endereço de entrega diferente do cadastro é **geocodificado no servidor**. Aceitar
  `lat`/`lng` do navegador deixaria alguém informar um ponto pertinho da loja e
  receber do outro lado da cidade pagando frete de esquina.
- O endereço fica **congelado no pedido**: se a cliente mudar de casa depois, o
  pedido antigo mantém o endereço certo.

---

## Rodando localmente

```bash
npm install
```

```bash
npm run dev
```

Abre em `http://localhost:3000`.

Scripts disponíveis: `npm run dev`, `npm run build`, `npm run start`, `npm run lint`.

> Rodando local, o Mercado Pago não recebe `notification_url` (ele não aceita
> endereço `localhost`), então o webhook não chega — o status do pedido não avança
> sozinho na sua máquina.

---

## Variáveis de ambiente

Ficam em `.env.local` no desenvolvimento e nas *Environment Variables* do projeto
na Vercel em produção. Nenhum valor mora no repositório.

| Nome | Para quê |
| --- | --- |
| `DATABASE_URL` | Conexão com o Neon Postgres |
| `ADMIN_PASSWORD` | Senha que a Camily digita para entrar no painel |
| `ADMIN_SESSION_SECRET` | Chave que assina os cookies de sessão (painel **e** cliente) |
| `MERCADOPAGO_ACCESS_TOKEN` | Token de acesso da conta do Mercado Pago |
| `RESEND_API_KEY` | Chave da conta do Resend |
| `EMAIL_REMETENTE` | De onde o e-mail sai, ex: `Doceterapia <nao-responda@dominio.com.br>` |
| `BLOB_READ_WRITE_TOKEN` | Acesso ao Vercel Blob (a Vercel preenche ao ligar o store) |

Notas:

- O Resend só entrega a partir de **domínio verificado** — o remetente precisa ser
  do domínio próprio da loja.
- Sem `ADMIN_PASSWORD` ou `ADMIN_SESSION_SECRET` configurados, o painel não deixa
  ninguém entrar (falha segura, e não o contrário).
- Sem `MERCADOPAGO_ACCESS_TOKEN`, o checkout responde "Pagamento ainda não
  configurado" em vez de quebrar.

---

## Banco de dados

O esquema vive em [lib/db/schema.ts](lib/db/schema.ts) (Drizzle). As tabelas:
`produtos`, `categorias`, `sabores`, `clientes`, `pedidos`, `carrinhos`,
`codigos_senha`, `cupons`, `pontos`, `avaliacoes`, `stories`, `recompensas`,
`config_loja` e `config_frete`.

### Migrar

As mudanças de esquema estão em [scripts/migrar.ts](scripts/migrar.ts), escritas à
mão e **aditivas**: acrescentam colunas, tabelas e índices, e nunca apagam dado nem
coluna. O mais longe que vão é afrouxar uma regra. Rodar duas vezes não faz mal.

```bash
npx dotenv -e .env.local -- npx tsx scripts/migrar.ts
```

O script imprime uma conferência no fim, dizendo o que foi criado e o que não foi.

### Popular com dados de exemplo

Opcional, só para um banco vazio — cria dois doces e a configuração de frete
padrão. Também é idempotente.

```bash
npx dotenv -e .env.local -- npx tsx scripts/seed.ts
```

---

## Deploy

O repositório está ligado à Vercel: **todo push na `main` vira deploy de
produção**, servido em doceterapia.net.br. Ao mudar o esquema, rode a migração
apontando para o banco de produção **antes** de subir o código que depende dela.

---

## Mapa das pastas

```
app/
  (telas)      catalogo, doce/[slug], carrinho, checkout, conta,
               entrar, cadastro, esqueci-senha, pedido/*, politica
  @gaveta/     rota paralela: o doce aberto por dentro do cardápio
  admin/       painel da Camily
  api/         rotas de servidor (pagamento, pedidos, produtos, cliente, ...)
components/    peças de tela reaproveitadas
lib/           regras de negócio: frete, estoque, cupom, fidelidade,
               sessão, e-mail, geocodificação, validações
  db/          esquema e conexão (Drizzle + Neon)
scripts/       migrar.ts e seed.ts
```

O sistema visual (paleta, tipografia, componentes, tom de voz) está documentado na
skill `design-doceterapia`, em `.claude/skills/design-doceterapia/`.
