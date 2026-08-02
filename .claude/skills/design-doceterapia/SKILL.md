---
name: design-doceterapia
description: Sistema visual do site da Doceterapia — paleta, tipografia, formas, componentes prontos, regras de celular e tom de voz. Use SEMPRE que for criar ou alterar qualquer tela, componente, card, botão, formulário ou texto que o cliente ou a Camily veem, e também ao adaptar componente vindo de shadcn/ui, v0, Magic MCP ou qualquer gerador — é aqui que está escrito como repintar o que eles devolvem para não descaracterizar o site.
---

# O jeito Doceterapia

Site de doces artesanais da **Camily Vilasboa**, em Arapongas-PR. Não é um
e-commerce genérico: é a loja de uma pessoa só, que conhece as clientes pelo
nome e conversa com elas no WhatsApp. O visual precisa parecer **feito à mão,
caprichado e acolhedor** — nunca "plataforma de tecnologia".

**Quase todo acesso vem do celular**, pelo link na bio do Instagram. Toda
decisão de layout começa pela tela pequena.

## Paleta

Definida em `tailwind.config.js`, tirada da logo. Use sempre pelo nome da
classe, nunca o hex solto no meio do código.

| Classe | Cor | Onde usar |
|---|---|---|
| `cream` | `#FDF0EA` | fundo da página (já vem do `body`) |
| `blush` | `#FBDDE0` | fundo de destaque, avisos suaves, área da foto |
| `cherryDark` | `#8C1D2B` | ação principal, título, preço, alerta |
| `cherryMid` | `#C2415A` | hover do botão, detalhe secundário |
| `cherryLight` | `#F0A6B8` | bordas, o "terapia" da logo, traços finos |
| `ink` | `#3B1A1F` | texto (quase preto, puxado pro vinho) |

Transparência é a ferramenta principal de hierarquia: `text-ink/70` para texto
de apoio, `text-ink/50` para dica, `border-cherryLight/30` para borda discreta,
`bg-white/70` para cartão sobre o fundo creme.

Verde e âmbar entram **só como sinal**, nunca como decoração: verde
(`green-100/green-700`) para confirmação e "pronta entrega"; âmbar
(`amber-100/amber-800`) para atenção e prazo apertado.

## Tipografia

Duas fontes, carregadas no `layout.tsx`:

- `font-display` → **Fraunces** (serifada). Títulos, nome do doce, preço,
  números grandes. É ela que dá o ar artesanal.
- `font-body` → **Nunito** (arredondada). Todo o resto.

Nunca use serifada em texto corrido nem sem-serifa em título — a troca é o que
mantém a personalidade.

## Formas

O **arco** é a assinatura visual: o topo do card do cardápio usa
`rounded-t-[999px]`, criando uma curva alta que lembra a logo.

⚠️ **Armadilha que já causou bug em produção:** um raio gigante junto com
`overflow-hidden` no card **recorta o conteúdo** — o preço e o botão
"Adicionar" apareciam comidos pela curva. A regra é:

```tsx
// certo: o recorte fica só na foto; a base do card é suave
<div className="bg-white/70 rounded-t-[999px] rounded-br-3xl rounded-bl-md border border-cherryLight/30 flex flex-col">
  <div className="aspect-square overflow-hidden rounded-t-[999px]">…foto…</div>
  <div className="p-4">…conteúdo…</div>
</div>
```

Nunca coloque `overflow-hidden` num container que tenha texto ou botão perto de
canto arredondado grande.

Fora do cardápio, use raios normais: `rounded-xl` em campo, `rounded-2xl` em
card de painel, `rounded-full` em botão e etiqueta.

## Componentes que já existem — use, não recrie

| Componente | Para quê |
|---|---|
| `components/CampoNumero.tsx` | **Todo** campo de número (preço, custo, frete, pontos, estoque) |
| `components/Estrelas.tsx` | Nota, em leitura ou escolha |
| `components/CherryDivider.tsx` | Separador com cerejas entre blocos |
| `components/RodapeLinks.tsx` | Rodapé enxuto (telas sem o rodapé grande) |
| `components/Footer.tsx` | Rodapé completo, com a bio da Camily |
| `components/Header.tsx` | Cabeçalho; já sabe se tem alguém logado |
| `components/EscolherFoto.tsx` | Envio de imagem no painel |
| `lib/formato.ts` → `reais()` | **Todo** valor em dinheiro |

**Nunca use `<input type="number">`.** Ao digitar vírgula o navegador devolve
texto vazio, e o campo apaga sozinho o que a pessoa escreveu. Use `CampoNumero`.

**Todo dinheiro sai com vírgula:** `reais(16)` → `R$ 16,00`. Nunca
`toFixed(2)` direto na tela.

## Celular em primeiro lugar

`app/globals.css` já resolve o essencial para todas as telas de uma vez — não
repita nem contrarie:

- campos com `min-width: 0` (senão criam rolagem lateral dentro de grid);
- campo com **16px** em tela pequena (menos que isso faz o iPhone dar zoom
  sozinho e deixar a página torta);
- qualquer coisa clicável com **44px** de altura mínima no toque;
- `overflow-x: clip` como rede de segurança.

Ao criar tela nova:

- comece pensando em **320px** de largura e vá subindo (`sm:`, `md:`);
- empilhe no celular, divida a linha só a partir de `sm:`;
- fileira de filtros ou abas rola na horizontal: `flex overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0`;
- botão de ação principal ocupa a largura toda no celular;
- confira que nada estoura: nenhum elemento pode ser mais largo que a tela
  (exceto dentro de container com rolagem proposital).

## Como as telas conversam

Escreva como a **Camily falaria com uma cliente** — primeira pessoa, direto,
sem termo técnico. O sistema nunca "informa" nem "processa".

| Não escreva | Escreva |
|---|---|
| "Erro ao processar requisição" | "Não consegui enviar agora. Tenta de novo?" |
| "Produto indisponível" | "Esse doce esgotou 😢" |
| "Preencha os campos obrigatórios" | "Falta a rua e o número para eu calcular a entrega." |
| "Operação realizada com sucesso" | "Prontinho, seus dados foram salvos. 🍒" |

Emoji com moderação e sempre no fim da frase — 🍒 é o da casa. Erro sério
não leva emoji.

Toda mensagem de erro precisa dizer **o que fazer em seguida**. Quando a saída
for falar com a Camily, ofereça o botão do WhatsApp (`lib/contato.ts`), com a
mensagem já escrita.

## Estados que toda tela precisa ter

1. **Carregando** — texto simples e curto ("Carregando seus pedidos..."), nunca
   tela em branco.
2. **Vazio** — emoji grande, uma frase acolhedora e um caminho de saída
   ("Você ainda não fez nenhum pedido" + botão "Ver o cardápio").
3. **Erro** — o que houve e o que fazer, em `text-cherryDark`.
4. **Sucesso** — confirmação em verde discreto, some da frente do caminho.

## Antes de dar por pronto

- [ ] Abre bem em 320px, sem rolagem lateral?
- [ ] Todo clicável tem 44px de altura?
- [ ] Dinheiro com vírgula, via `reais()`?
- [ ] Campo de número usando `CampoNumero`?
- [ ] Título em `font-display`, resto em `font-body`?
- [ ] Cores pelas classes da paleta, sem hex solto?
- [ ] Nada recortado por canto arredondado com `overflow-hidden`?
- [ ] As mensagens soam como a Camily, e dizem o que fazer?
- [ ] Estados de carregando, vazio e erro existem?

## Ao trazer componente de fora (shadcn, v0, Magic MCP…)

O que esses geradores devolvem é bem construído por dentro e **neutro por
fora** — cinza, canto pequeno, sombra fria, fonte sem-serifa. Colar direto
descaracteriza o site. Traga a **estrutura e o comportamento** (foco, teclado,
acessibilidade) e repinte:

1. troque as cores pelas classes da paleta;
2. título e números para `font-display`;
3. botão para `rounded-full`, com `bg-cherryDark` e `hover:bg-cherryMid`;
4. borda para `border-cherryLight/30`, fundo para `bg-white/70`;
5. reescreva todo o texto no tom da Camily, em português;
6. confira os 44px de toque e os 16px de campo.
