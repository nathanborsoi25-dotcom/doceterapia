# Doceterapia

Site de vendas da Camily Vilasboa — doces artesanais em Arapongas, PR.

## O que já está pronto (v0 — esqueleto navegável)

- Cadastro obrigatório do cliente (nome, CPF, endereço, telefone)
- Catálogo de doces (foto, nome, descrição, sabor, preço, pronta entrega/sob encomenda)
- Carrinho de compras
- Checkout com escolha de **entrega ou retirada agendada** + forma de pagamento (Pix, crédito, débito, sem parcelamento)
- Cálculo de frete por faixa de distância (fórmula de Haversine a partir do seu endereço)
- Painel admin (protegido por PIN): editar/adicionar produtos, configurar frete, ver clientes
- Identidade visual baseada na logo (tons de vermelho cereja e rosa, tipografia serifada)

Por enquanto os dados ficam salvos no **localStorage do navegador** — ou seja, o site já é 100% navegável e demonstrável, mas cada pessoa vê seus próprios dados e nada é compartilhado entre dispositivos ainda. Isso é proposital: primeiro validamos o fluxo inteiro com você, depois plugamos o banco de verdade.

## Próximos passos (na ordem que eu sugiro)

1. **Banco de dados real** — trocar `lib/store.ts` por um banco de verdade (recomendo Vercel Postgres ou Supabase, ambos têm integração de um clique com a Vercel). Isso é o que vai permitir que pedidos e clientes fiquem salvos de verdade e apareçam no seu painel admin não importa o dispositivo.
2. **Mercado Pago** — criar as rotas de API (`app/api/pagamento/route.ts`) que geram a cobrança Pix e o checkout de cartão via SDK do Mercado Pago. Você vai precisar da sua `MERCADOPAGO_ACCESS_TOKEN` (nas configurações da sua conta Mercado Pago) como variável de ambiente na Vercel.
3. **Geocodificação automática do endereço** — hoje o `lat/lng` do cliente fica em branco no cadastro; o ideal é geocodificar automaticamente o endereço digitado (Google Geocoding API ou Nominatim/OpenStreetMap, que é gratuito) assim que o cliente preenche o CEP/endereço, pra o cálculo de frete funcionar sozinho.
4. **Login seguro do admin** — o PIN atual (`app/admin/login/page.tsx`) é só um placeholder visível no código. Trocar por autenticação de verdade (NextAuth, por exemplo) antes de lançar.
5. **Upload de fotos** — hoje é só um campo de URL. Dá pra evoluir para upload direto (Vercel Blob Storage) quando formos mexer no admin de produtos.
6. **Deploy** — subir este repositório no seu GitHub e conectar na Vercel (importar o repositório direto pelo painel da Vercel já faz o deploy e te dá um domínio `.vercel.app`; depois dá pra apontar um domínio próprio, tipo `doceterapia.com.br`, se você quiser comprar um).

## Rodando localmente

```bash
npm install
npm run dev
```

Abre em `http://localhost:3000`.
