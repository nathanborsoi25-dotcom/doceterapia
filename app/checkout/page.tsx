"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import CherryDivider from "@/components/CherryDivider";
import RodapeLinks from "@/components/RodapeLinks";
import EnderecoVisitante from "@/components/EnderecoVisitante";
import PagamentoNoSite from "@/components/PagamentoNoSite";
import IconeWhatsApp from "@/components/IconeWhatsApp";
import { descontoDoPix, percentualDoPix, percentualEscrito } from "@/lib/desconto-pix";
import { avisoDeFechada, limparFuncionamento, lojaAberta } from "@/lib/funcionamento";
import { avisoDeEntregaHoje, limparHorarioDeEntrega } from "@/lib/entrega-horario";
import { reais } from "@/lib/formato";
import { prazoDoSabor } from "@/lib/sabores";
import { ehResgate, faltaDocePago, nadaACobrar } from "@/lib/resgate";
import {
  conferirPrecos,
  contarMudanca,
  type MudancaNoCarrinho,
} from "@/lib/precos-carrinho";
import {
  getCarrinho,
  salvarCarrinho,
  type EnderecoVisitante as EnderecoDeVisitante,
} from "@/lib/store";
import {
  getClienteLogado,
  getConfiguracaoFrete,
  getProdutos,
  iniciarPagamento,
  validarCupom,
} from "@/lib/api";
import { prazoMaximoEmDias } from "@/lib/prazo";
import { pontosDaLoja, type PontoRetirada } from "@/lib/retirada";
import type { Cliente, ItemPedido } from "@/lib/types";
import {
  calcularFretePorEndereco,
  faltaParaFreteGratis,
  minimoFreteGratis,
  type CalculoFrete,
} from "@/lib/shipping";
import { checarAreaEntrega } from "@/lib/area-entrega";
import { useSobre } from "@/lib/usar-sobre";
import type { ConfiguracaoFrete, FormaPagamento, TipoEntrega } from "@/lib/types";

/**
 * A chave PÚBLICA do Mercado Pago. Ela é pública mesmo — vai no navegador e
 * serve só para tokenizar o cartão. Sem ela configurada, o botão de pagar
 * aqui dentro nem aparece, e o site segue com o Checkout Pro de sempre.
 */
const CHAVE_MP = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ?? "";

export default function CheckoutPage() {
  const [tipoEntrega, setTipoEntrega] = useState<TipoEntrega>("entrega");
  /** Qual dos pontos a cliente escolheu pra buscar (só na retirada). */
  const [pontoRetirada, setPontoRetirada] = useState("");
  /** Os endereços de retirada que a Camily configurou no painel. */
  const [pontos, setPontos] = useState<PontoRetirada[]>([]);
  const [frete, setFrete] = useState<CalculoFrete | null>(null);
  const [config, setConfig] = useState<ConfiguracaoFrete | null>(null);
  /**
   * Qual botão de pagar está em andamento — ou `null`. Guarda a forma, e não
   * só um "true", pra escrever "Abrindo o Pix..." no botão certo quando os
   * dois estão na tela.
   */
  const [finalizando, setFinalizando] = useState<FormaPagamento | null>(null);

  /**
   * Desconto de quem paga no Pix, em %. Vem da loja: a Camily ajusta em
   * Promoções, e zero desliga (aí só aparece um botão de pagar).
   */
  const [percentualPix, setPercentualPix] = useState(0);
  /** Loja fechada: os botões de pagar saem do ar e um aviso toma o lugar. */
  const [fechada, setFechada] = useState<string | null>(null);
  /**
   * Pedido já gravado, esperando o pagamento acontecer AQUI (Payment Brick).
   * Enquanto for nulo, a tela mostra os botões de sempre.
   */
  const [pagarAqui, setPagarAqui] = useState<{ pedidoId: string; total: number } | null>(null);
  /** O Pix gerado sem sair do site: QR e copia-e-cola. */
  const [pix, setPix] = useState<{ copiaECola: string | null; qrCodeBase64: string | null } | null>(null);
  const [copiado, setCopiado] = useState(false);
  /**
   * As entregas de hoje já encerraram?
   *
   * A loja aceita pedido até as 22h, mas quem entrega é a Camily, e nos dias
   * de semana ela para às 16h30. Sem este aviso, quem compra um doce de
   * pronta entrega às 20h de uma terça acha que recebe naquela noite.
   */
  const [entregaSoAmanha, setEntregaSoAmanha] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/config-loja", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => {
        setPercentualPix(percentualDoPix(c?.descontoPix));
        const f = limparFuncionamento(c?.funcionamento);
        setFechada(lojaAberta(f) ? null : avisoDeFechada(f));
        setEntregaSoAmanha(avisoDeEntregaHoje(limparHorarioDeEntrega(c?.entrega)));
      })
      .catch(() => setPercentualPix(0));
  }, []);

  /**
   * O carrinho mora no navegador, então o servidor não tem como conhecê-lo:
   * ele é lido DEPOIS de montar. Ler durante a renderização faria o servidor
   * desenhar a lista vazia e o navegador desenhar os doces — e o React
   * reclamaria da diferença bem na tela de pagar.
   */
  const [carrinho, setCarrinho] = useState<ItemPedido[]>([]);
  useEffect(() => setCarrinho(getCarrinho()), []);
  // O cliente vem da sessão no servidor, não do navegador: assim o endereço
  // usado no frete é o que está de fato cadastrado na conta.
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [carregandoCliente, setCarregandoCliente] = useState(true);
  // Endereço digitado na tela: de quem ainda não criou conta, ou de quem quer
  // entregar em outro lugar (presente, casa da mãe, trabalho).
  const [enderecoVisitante, setEnderecoVisitante] = useState<EnderecoDeVisitante | null>(null);
  const [outroEndereco, setOutroEndereco] = useState(false);

  // Cupom de desconto.
  const [mostrarCupom, setMostrarCupom] = useState(false);
  const [codigoCupom, setCodigoCupom] = useState("");
  const [conferindoCupom, setConferindoCupom] = useState(false);
  const [erroCupom, setErroCupom] = useState("");
  const [cupomAplicado, setCupomAplicado] = useState<{
    codigo: string;
    desconto: number;
    /** Pegou só parte do carrinho: o resto já estava em promoção. */
    valeuEmParte?: boolean;
  } | null>(null);

  // Presente e bilhete.
  const [ehPresente, setEhPresente] = useState(false);
  const [nomeQuemRecebe, setNomeQuemRecebe] = useState("");
  const [querBilhete, setQuerBilhete] = useState(false);
  const [bilhete, setBilhete] = useState("");
  const subtotal = carrinho.reduce((acc, i) => acc + i.precoUnitario * i.quantidade, 0);
  // O desconto nunca come o frete: ele abate o valor dos doces, e no máximo
  // até zerá-los. Quem confere isso de verdade é o servidor.
  const desconto = Math.min(cupomAplicado?.desconto ?? 0, subtotal);
  /**
   * Quanto ela levou em doces — ANTES do cupom. É este valor que decide o
   * frete grátis.
   *
   * Descontar o cupom aqui fazia o frete voltar a ser cobrado quando ela
   * usava um desconto: juntava R$ 65, ganhava a entrega, aplicava o cupom e
   * perdia de novo. Quem bateu a meta em doces bateu a meta.
   */
  const valorEmDoces = subtotal;

  // Dias de encomenda do carrinho: o prazo vem do produto no banco, não do
  // carrinho salvo no navegador (que pode estar desatualizado).
  const [prazoDias, setPrazoDias] = useState(0);

  useEffect(() => {
    // Os endereços de retirada saem do painel: se a Camily mudar de ponto,
    // a tela muda junto, sem precisar de deploy.
    fetch("/api/config-loja", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => setPontos(pontosDaLoja(c?.pontosRetirada)))
      .catch(() => setPontos(pontosDaLoja(null)));
    getConfiguracaoFrete()
      .then(setConfig)
      .catch(() => setConfig(null));
    getClienteLogado()
      .then(setCliente)
      .catch(() => setCliente(null))
      .finally(() => setCarregandoCliente(false));
    getProdutos()
      .then((lista) => {
        const porId = new Map(lista.map((p) => [p.id, p]));
        // O prazo sai do RECHEIO escolhido quando existe: dois recheios da
        // mesma torta podem ter prazos diferentes.
        setPrazoDias(
          prazoMaximoEmDias(
            carrinho.map((item) => {
              const produto = porId.get(item.produtoId);
              if (!produto) return 0;
              const sabor = (produto.sabores ?? []).find((s) => s.id === item.saborId);
              return prazoDoSabor(produto, sabor);
            })
          )
        );
      })
      .catch(() => setPrazoDias(0));
  }, [carrinho]);

  /**
   * Confere os preços contra o cardápio de agora, na última tela antes de
   * pagar.
   *
   * O carrinho pode ter sido montado dias atrás. Sem isto a pessoa via um
   * total aqui e o Mercado Pago cobrava outro — o servidor sempre refez a
   * conta pelo banco, então quem estava errada era a tela.
   *
   * Não dá laço: depois de corrigido, a conferência seguinte não acha mais
   * nada pra mudar.
   */
  const [mudancas, setMudancas] = useState<MudancaNoCarrinho[]>([]);
  useEffect(() => {
    if (carrinho.length === 0) return;
    getProdutos()
      .then((lista) => {
        const conferido = conferirPrecos(carrinho, lista);
        if (conferido.mudancas.length === 0) return;
        setMudancas(conferido.mudancas);
        setCarrinho(conferido.itens);
        salvarCarrinho(conferido.itens);
        // O cupom foi calculado sobre os preços antigos; com o carrinho outro,
        // ele precisa ser conferido de novo pra não prometer desconto que o
        // servidor vai recusar.
        setCupomAplicado(null);
      })
      .catch(() => {});
  }, [carrinho]);

  /**
   * O endereço que vale nesta tela: o do cadastro quando a pessoa está
   * logada, o digitado aqui quando ainda não está. Os dois calculam o frete
   * do mesmo jeito — o que muda é que, na hora de fechar o pedido, o servidor
   * usa SEMPRE o do cadastro (o único que ninguém consegue forjar).
   */
  const enderecoAtual = useMemo(() => {
    // Logada, mas pediu pra entregar em outro lugar: vale o que ela digitou.
    if (cliente && !outroEndereco) return cliente.endereco;
    if (!enderecoVisitante) return null;
    return {
      rua: enderecoVisitante.rua,
      numero: enderecoVisitante.numero,
      bairro: enderecoVisitante.bairro,
      cidade: enderecoVisitante.cidade,
      cep: enderecoVisitante.cep,
      complemento: enderecoVisitante.complemento,
      lat: enderecoVisitante.lat,
      lng: enderecoVisitante.lng,
    };
  }, [cliente, outroEndereco, enderecoVisitante]);

  /** Endereço ainda em branco: a pessoa nem começou a preencher. */
  const enderecoEmBranco =
    !enderecoAtual || (!enderecoAtual.rua && !enderecoAtual.cep);
  /** Começou mas ainda falta rua ou número — não é erro, é digitação em curso. */
  const enderecoIncompleto =
    !enderecoEmBranco && (!enderecoAtual?.rua || !enderecoAtual?.numero);

  /*
   * O frete acompanha o carrinho: cada doce a mais pode ser o que zera a
   * entrega, e a linha do frete precisa mudar na mesma hora. Por isso o
   * `valorEmDoces` entra na conta junto com o endereço.
   */
  useEffect(() => {
    if (tipoEntrega !== "entrega" || !enderecoAtual || !config) return;
    if (enderecoAtual.lat && enderecoAtual.lng) {
      setFrete(
        calcularFretePorEndereco(enderecoAtual.lat, enderecoAtual.lng, config, {
          valorEmDoces,
        })
      );
    } else {
      setFrete(null);
    }
  }, [tipoEntrega, enderecoAtual, config, valorEmDoces]);

  // A Doceterapia só atende Arapongas-PR: endereço de outra cidade trava a
  // compra inteira (entrega e retirada) e manda pro WhatsApp da Camily.
  const area = useMemo(
    () =>
      enderecoAtual && !enderecoEmBranco
        ? checarAreaEntrega({
            cep: enderecoAtual.cep,
            cidade: enderecoAtual.cidade,
            bairro: enderecoAtual.bairro,
            rua: enderecoAtual.rua,
          })
        : { atendido: true as boolean, motivo: undefined as string | undefined },
    [enderecoAtual, enderecoEmBranco]
  );

  // O endereço só tem coordenadas se a geocodificação funcionou. Sem elas não
  // dá pra calcular distância — e sem distância não dá pra cobrar frete.
  const semCoordenadas = !enderecoAtual?.lat || !enderecoAtual?.lng;
  const carregandoFrete =
    tipoEntrega === "entrega" && (!config || carregandoCliente);
  const foraDaArea =
    tipoEntrega === "entrega" && !semCoordenadas && frete !== null && frete.valor === null;
  // Trava o checkout quando o frete não pôde ser determinado, pra não sair
  // pedido de entrega com frete R$ 0,00.
  const freteIndisponivel =
    tipoEntrega === "entrega" && (carregandoFrete || semCoordenadas || frete?.valor == null);
  // Só a ENTREGA depende do endereço. Quem é de fora de Arapongas (ou tem
  // endereço que não localizamos) ainda pode comprar escolhendo Retirada,
  // porque nesse caso vem buscar pessoalmente.
  /**
   * Prêmio sozinho não fecha pedido: precisa de pelo menos um doce pago junto,
   * na entrega e na retirada. Quem barra de verdade é o servidor; aqui o aviso
   * aparece cedo, pra ela não descobrir só no clique de pagar.
   */
  const soTemPremio = faltaDocePago(carrinho);

  const compraBloqueada =
    soTemPremio || (tipoEntrega === "entrega" && (!area.atendido || freteIndisponivel));

  const valorFrete = tipoEntrega === "retirada" ? 0 : frete?.valor ?? 0;
  const total = subtotal - desconto + valorFrete;

  /**
   * Quanto falta pra entrega sair de graça.
   *
   * Só aparece na ENTREGA e quando falta pouco de verdade: dizer "faltam
   * R$ 80" pra quem tem um brigadeiro no carrinho não convida, cobra.
   */
  const minimoGratis = config ? minimoFreteGratis(config) : 0;
  const faltaGratis = faltaParaFreteGratis(valorEmDoces, minimoGratis);
  const mostrarQuantoFalta =
    tipoEntrega === "entrega" &&
    faltaGratis > 0 &&
    valorEmDoces > 0 &&
    faltaGratis <= minimoGratis * 0.6;

  /**
   * Quanto o Pix abate deste pedido. A mesma conta roda no servidor na hora
   * de cobrar — aqui é só pra pessoa ver o valor antes de apertar o botão.
   */
  const descontoPix = descontoDoPix("pix", total, percentualPix);

  /**
   * Pedido sem nada a cobrar — na prática, o prêmio de pontos retirado na mão.
   *
   * Aqui ele troca os dois botões de pagar por um só de confirmar: "Pagar com
   * Pix — R$ 0,00" faria a pessoa procurar o que ela deve, e o Mercado Pago
   * nem chega a ser aberto nesse caso. A conta que vale continua sendo a do
   * servidor; esta é só pra montar a tela.
   */
  const semCobranca = nadaACobrar(total - descontoPix);

  /** Nada de pagar enquanto falta endereço, ponto de retirada ou resposta. */
  /*
   * Conta de teste compra com a loja fechada — é o único jeito de provar o
   * pagamento de madrugada, que é quando ele costuma ser mexido. Quem decide
   * é o SERVIDOR (`lib/testadores.ts`); aqui só se obedece ao sinal que veio
   * junto com o cadastro, senão a tela esconderia os botões dele.
   */
  const lojaFechadaPraMim = fechada && !cliente?.podeTestarFechado ? fechada : null;

  const pagamentoBloqueado =
    (tipoEntrega === "retirada" && !pontoRetirada) ||
    finalizando !== null ||
    compraBloqueada;

  /**
   * Cria o pedido e abre o pagamento AQUI, sem mandar ninguém para o Mercado
   * Pago. O pedido é gravado do mesmo jeito de sempre; o que muda é só quem
   * cobra depois.
   */
  async function pagarSemSair() {
    if (!cliente) {
      window.location.assign("/entrar?voltar=/checkout");
      return;
    }

    setFinalizando("pix");
    try {
      const r = await iniciarPagamento({
        clienteId: cliente.id,
        itens: carrinho,
        tipoEntrega,
        pontoRetirada: tipoEntrega === "retirada" ? pontoRetirada : "",
        entregarEmOutroEndereco: outroEndereco,
        enderecoEntrega:
          tipoEntrega === "entrega"
            ? outroEndereco
              ? enderecoAtual ?? undefined
              : cliente?.endereco
            : undefined,
        valorFrete,
        formaPagamento: "pix",
        ehPresente,
        nomeQuemRecebe: ehPresente ? nomeQuemRecebe : "",
        bilhete: querBilhete ? bilhete : "",
        cupom: cupomAplicado?.codigo ?? "",
        pagarNoSite: true,
      });

      if (r.pedidoId) {
        setPagarAqui({ pedidoId: r.pedidoId, total: r.total ?? total - descontoPix });
      } else {
        alert("Não foi possível abrir o pagamento. Tente pelo botão do Mercado Pago.");
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Não foi possível abrir o pagamento.");
    } finally {
      setFinalizando(null);
    }
  }

  async function aplicarCupom() {
    setErroCupom("");
    setConferindoCupom(true);
    try {
      const r = await validarCupom(codigoCupom, carrinho);
      setCupomAplicado({
        codigo: r.codigo,
        desconto: r.desconto,
        valeuEmParte: r.valeuEmParte,
      });
      setMostrarCupom(false);
    } catch (e) {
      setErroCupom(
        e instanceof Error && e.message
          ? e.message
          : "Não consegui conferir esse cupom agora."
      );
    } finally {
      setConferindoCupom(false);
    }
  }

  function tirarCupom() {
    setCupomAplicado(null);
    setCodigoCupom("");
    setErroCupom("");
    setMostrarCupom(false);
  }

  /**
   * Fecha o pedido na forma que a pessoa apertou.
   *
   * A forma vai junto porque é ela que decide duas coisas no servidor: se o
   * desconto do Pix entra, e em qual forma o Checkout do Mercado Pago vai
   * abrir travado. O valor do desconto, esse, é sempre recalculado lá —
   * o que vem daqui é só o botão que foi clicado.
   */
  async function handleFinalizar(forma: FormaPagamento) {
    if (carrinho.length === 0) {
      alert("Seu carrinho está vazio.");
      return;
    }

    // É AQUI que a conta passa a ser necessária: até este clique dá pra
    // navegar, montar o carrinho e ver o frete sem cadastro nenhum. Depois de
    // entrar, a pessoa volta direto pra esta tela com o carrinho intacto.
    if (!cliente) {
      window.location.assign("/entrar?voltar=/checkout");
      return;
    }

    setFinalizando(forma);
    try {
      // Cria o pedido e inicia o pagamento no Mercado Pago.
      const { url, pedidoId, semCobranca } = await iniciarPagamento({
        clienteId: cliente?.id ?? "",
        itens: carrinho,
        tipoEntrega,
        pontoRetirada: tipoEntrega === "retirada" ? pontoRetirada : "",
        // Entregando em outro lugar, o endereço vai junto — o servidor
        // confere a área e recalcula o frete a partir dele.
        entregarEmOutroEndereco: outroEndereco,
        enderecoEntrega:
          tipoEntrega === "entrega"
            ? outroEndereco
              ? enderecoAtual ?? undefined
              : cliente?.endereco
            : undefined,
        valorFrete,
        formaPagamento: forma,
        ehPresente,
        nomeQuemRecebe: ehPresente ? nomeQuemRecebe : "",
        bilhete: querBilhete ? bilhete : "",
        cupom: cupomAplicado?.codigo ?? "",
      });
      if (semCobranca) {
        /*
         * Prêmio de pontos retirado na mão: não há o que pagar, e o pedido já
         * saiu confirmado do servidor. Vai pra mesma tela de quem volta do
         * Mercado Pago aprovado — é ela que mostra a confirmação e esvazia o
         * carrinho, e ter duas telas de "deu certo" só criaria duas versões da
         * mesma boa notícia.
         */
        window.location.href = `/pedido/sucesso?status=approved&external_reference=${pedidoId}`;
      } else if (url) {
        // Redireciona para o checkout seguro do Mercado Pago (Pix/cartão).
        window.location.href = url;
      } else {
        alert("Não foi possível iniciar o pagamento. Tente novamente.");
        setFinalizando(null);
      }
    } catch (e) {
      alert(
        e instanceof Error && e.message
          ? e.message
          : "Não foi possível iniciar o pagamento. Verifique sua conexão e tente novamente."
      );
      setFinalizando(null);
    }
  }

  return (
    <>
      <Header />
      <main className="px-4 sm:px-6 md:px-12 pb-16 max-w-xl mx-auto">
        <h1 className="font-display text-2xl sm:text-3xl text-center text-cherryDark">
          Entrega e pagamento
        </h1>
        <CherryDivider />

        {!area.atendido && (
          <div className="bg-blush/70 border border-cherryLight/60 rounded-2xl p-5 mb-6 text-center">
            <p className="font-display text-lg text-cherryDark">
              Não entregamos no seu endereço
            </p>
            <p className="font-body text-sm text-ink/75 mt-2">
              {area.motivo} A Doceterapia entrega somente em Arapongas-PR, por
              isso a opção <strong>Entrega</strong> fica indisponível pra você.
            </p>
            <p className="font-body text-sm text-ink/75 mt-2">
              Mas você ainda pode comprar escolhendo <strong>Retirada</strong> e
              buscar seus doces com a Camily — ou falar com ela pelo WhatsApp.
            </p>
            <BotaoWhatsApp mensagem="Oi, Camily! Vi o site da Doceterapia, mas meu endereço não é de Arapongas. Consigo fazer um pedido?" />
          </div>
        )}

        {/* O cardápio mudou depois que ela montou o carrinho. Aparece ANTES do
            resumo porque muda os números que vêm logo abaixo. */}
        {mudancas.length > 0 && (
          <div
            className={`rounded-xl border px-4 py-3.5 mb-6 ${
              mudancas.some((m) => m.tipo === "sumiu" || (m.para ?? 0) > (m.de ?? 0))
                ? "bg-blush/60 border-cherryLight/60"
                : "bg-green-50 border-green-200"
            }`}
          >
            <p className="font-body text-sm font-semibold text-ink/85">
              Confere só uma coisa antes de pagar
            </p>
            <ul className="grid gap-1 mt-1.5">
              {mudancas.map((m) => (
                <li key={m.chave} className="font-body text-sm text-ink/70">
                  {contarMudanca(m)}
                  {m.tipo === "preco" && (
                    <span className="text-ink/50">
                      {" "}
                      ({reais(m.de ?? 0)} → <strong>{reais(m.para ?? 0)}</strong>)
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p className="font-body text-xs text-ink/50 mt-2">
              O valor abaixo já está atualizado.
            </p>
          </div>
        )}

        {/* O que ela está levando, logo no começo: antes a tela pedia
            endereço e cartão sem mostrar em momento nenhum quais doces
            estavam sendo comprados. */}
        <section className="bg-white/60 border border-cherryLight/30 rounded-xl px-4 py-3 mb-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-base text-ink">Seu pedido</h2>
            <a
              href="/carrinho"
              className="text-xs font-body text-cherryDark underline inline-flex items-center min-h-[44px] px-1"
            >
              Mudar
            </a>
          </div>
          <ul className="grid gap-1 mt-1 font-body text-sm text-ink/75">
            {carrinho.map((i) => (
              <li
                key={`${i.produtoId}-${i.saborId ?? ""}`}
                className="flex justify-between gap-3"
              >
                <span className="min-w-0">
                  {ehResgate(i) && <span aria-hidden>🎁 </span>}
                  {i.quantidade}× {i.nome}
                  {i.saborNome && (
                    <span className="text-cherryMid"> · {i.saborNome}</span>
                  )}
                  {ehResgate(i) && (
                    <span className="block text-xs text-green-700">
                      Prêmio · {i.pontosGastos} pontos
                    </span>
                  )}
                </span>
                {/* O preço cheio riscado segue até aqui: é na hora de pagar
                    que a cliente confere se a oferta que a trouxe valeu. */}
                <span
                  className={`shrink-0 tabular-nums ${
                    ehResgate(i) ? "text-green-700 font-semibold" : ""
                  }`}
                >
                  {ehResgate(i) ? (
                    "Grátis"
                  ) : (
                    <>
                      {i.emPromocao && i.precoCheio && (
                        <span className="line-through text-ink/40 mr-1.5">
                          {reais(i.precoCheio * i.quantidade)}
                        </span>
                      )}
                      {reais(i.precoUnitario * i.quantidade)}
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="grid gap-3">
          <h2 className="font-display text-lg text-ink">Como você quer receber?</h2>
          <div className="flex gap-3">
            <OpcaoBotao
              ativo={tipoEntrega === "entrega"}
              onClick={() => setTipoEntrega("entrega")}
              label="Entrega"
            />
            <OpcaoBotao
              ativo={tipoEntrega === "retirada"}
              onClick={() => setTipoEntrega("retirada")}
              label="Retirada"
            />
          </div>

          {/* Endereço: quem tem conta vê o que está cadastrado (e o link pra
              mudar); quem ainda não tem digita aqui só pra ver o frete. */}
          {tipoEntrega === "entrega" && !carregandoCliente && (
            <div className="bg-white/60 border border-cherryLight/30 rounded-xl p-4 grid gap-2">
              {cliente && !outroEndereco ? (
                <>
                  <p className="text-sm font-body text-ink/80">
                    <strong>Entregar em:</strong> {cliente.endereco.rua},{" "}
                    {cliente.endereco.numero}
                    {cliente.endereco.bairro && ` — ${cliente.endereco.bairro}`}
                    {cliente.endereco.cidade && `, ${cliente.endereco.cidade}`}
                  </p>
                  <div className="flex flex-wrap gap-x-4">
                    <button
                      onClick={() => setOutroEndereco(true)}
                      className="text-sm text-cherryDark underline inline-flex items-center min-h-[44px]"
                    >
                      Entregar em outro endereço
                    </button>
                    {/* Vai direto na aba dos dados e volta pra cá depois de
                        salvar — não adianta despejar a cliente em "Meus
                        pedidos" no meio de uma compra. */}
                    <a
                      href="/conta?aba=dados&voltar=%2Fcheckout"
                      className="text-sm text-ink/60 underline inline-flex items-center min-h-[44px]"
                    >
                      Mudar meu endereço fixo
                    </a>
                  </div>
                </>
              ) : cliente && outroEndereco ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-body text-ink/70">
                      Entregar neste endereço, só neste pedido:
                    </p>
                    <button
                      onClick={() => setOutroEndereco(false)}
                      className="text-sm text-cherryDark underline inline-flex items-center min-h-[44px]"
                    >
                      Usar meu endereço
                    </button>
                  </div>
                  <EnderecoVisitante onChange={setEnderecoVisitante} />
                </>
              ) : (
                <>
                  <p className="text-sm font-body text-ink/70">
                    Diga onde você está pra eu calcular a entrega. Você só
                    precisa criar conta na hora de pagar.
                  </p>
                  <EnderecoVisitante onChange={setEnderecoVisitante} />
                </>
              )}
            </div>
          )}

          {tipoEntrega === "entrega" &&
            (carregandoFrete ? (
              <p className="text-sm font-body text-ink/70">
                Calculando o frete a partir do seu endereço...
              </p>
            ) : enderecoEmBranco ? (
              <p className="text-sm font-body text-ink/60">
                Preencha o endereço acima para ver o valor da entrega.
              </p>
            ) : enderecoIncompleto ? (
              <p className="text-sm font-body text-ink/60">
                Falta a rua e o número para eu calcular a entrega.
              </p>
            ) : !area.atendido ? (
              <AvisoFrete>
                <strong>Não é possível concluir a compra com entrega:</strong>{" "}
                seu endereço não é de Arapongas-PR, a única cidade que
                atendemos. Escolha <strong>Retirada</strong> acima para
                continuar.
              </AvisoFrete>
            ) : semCoordenadas ? (
              <AvisoFrete>
                <strong>Ainda não dá pra calcular a entrega:</strong> não
                conseguimos localizar esse endereço no mapa. Confira a rua e o
                número, escolha <strong>Retirada</strong> ou
                combine a entrega com a Camily pelo WhatsApp.
                <BotaoWhatsApp mensagem="Oi, Camily! Estou tentando fazer um pedido no site da Doceterapia, mas o site não conseguiu calcular o frete do meu endereço. Consegue me ajudar?" />
              </AvisoFrete>
            ) : foraDaArea ? (
              <AvisoFrete>
                <strong>Não é possível concluir a compra com entrega:</strong>{" "}
                seu endereço está distante demais da Camily (mais de 25 km).
                Escolha <strong>Retirada</strong> ou fale com ela pelo WhatsApp.
                <BotaoWhatsApp mensagem="Oi, Camily! Meu endereço aparece como distante demais no site da Doceterapia. Consigo receber mesmo assim?" />
              </AvisoFrete>
            ) : frete ? (
              <div className="grid gap-2">
                <p className="text-sm font-body text-ink/70">
                  Distância até você: {frete.distanciaKm} km — frete:{" "}
                  {frete.valor === 0 ? (
                    <strong className="text-green-700">grátis</strong>
                  ) : (
                    reais(frete.valor ?? 0)
                  )}
                </p>

                {/*
                 * Conquistou o frete grátis.
                 *
                 * O texto é o mesmo do banner do cardápio de propósito: a
                 * pessoa entrou por causa daquela promessa, e é aqui, na hora
                 * de pagar, que ela confere se foi cumprida. O zero na linha
                 * do frete, sozinho, passa despercebido.
                 */}
                {frete.gratisPorValor && (
                  <p className="flex items-start gap-2.5 text-sm font-body text-green-800 bg-green-50 border border-green-300 rounded-xl px-4 py-3.5">
                    <span aria-hidden className="text-lg leading-none">🎉</span>
                    <span>
                      <strong className="block text-base">
                        Você ganhou frete grátis!
                      </strong>
                      Seu pedido passou de {reais(minimoGratis)} em doces, então
                      a entrega é por nossa conta. 🍒
                    </span>
                  </p>
                )}

                {/* Falta pouco: o frete do Uber custa quase o mesmo em
                    qualquer valor, então mais um doce aqui rende sem custar
                    entrega nova. */}
                {mostrarQuantoFalta && (
                  <p className="text-sm font-body text-cherryDark bg-blush/60 border border-cherryLight/50 rounded-xl px-4 py-3">
                    Faltam <strong>{reais(faltaGratis)}</strong> em doces pra
                    sua entrega sair de graça.{" "}
                    <a href="/catalogo" className="underline">
                      Ver o cardápio
                    </a>
                  </p>
                )}
              </div>
            ) : null)}

          {/*
           * Retirada: a cliente escolhe ONDE buscar, e o dia e a hora ela
           * combina com a Camily. O campo de data que existia aqui marcava
           * horário sem ninguém do outro lado confirmar, e isso só gerava
           * desencontro na porta.
           */}
          {tipoEntrega === "retirada" ? (
            <div className="grid gap-2 mt-2">
              <p className="text-sm font-body text-ink/80">
                Onde você prefere buscar? *
              </p>
              {pontos.map((ponto) => {
                const escolhido = pontoRetirada === ponto.id;
                return (
                  <button
                    key={ponto.id}
                    type="button"
                    onClick={() => setPontoRetirada(ponto.id)}
                    aria-pressed={escolhido}
                    className={`text-left rounded-xl border-2 px-4 py-3 transition-colors ${
                      escolhido
                        ? "border-cherryDark bg-blush/50"
                        : "border-cherryLight/40 bg-white/60 hover:border-cherryMid"
                    }`}
                  >
                    <span className="flex items-start gap-2.5">
                      {/* Bolinha desenhada à mão: um radio de verdade fica
                          pequeno demais pro dedo e não aceita a cor da casa. */}
                      <span
                        aria-hidden
                        className={`mt-0.5 w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center ${
                          escolhido ? "border-cherryDark" : "border-cherryLight"
                        }`}
                      >
                        {escolhido && (
                          <span className="w-2.5 h-2.5 rounded-full bg-cherryDark" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-body font-semibold text-ink/85">
                          {ponto.endereco}
                        </span>
                        {ponto.horarios.map((h) => (
                          <span key={h} className="block text-xs font-body text-ink/60">
                            {h}
                          </span>
                        ))}
                      </span>
                    </span>
                  </button>
                );
              })}
              <p className="text-sm font-body text-ink/70 bg-white/60 border border-cherryLight/30 rounded-xl px-4 py-3">
                {prazoDias > 0
                  ? `Um dos doces do seu carrinho é feito sob encomenda e precisa de ${prazoDias} ${prazoDias === 1 ? "dia" : "dias"} de preparo. `
                  : ""}
                O dia e o horário você combina com a Camily pelo WhatsApp, assim
                que o pagamento for confirmado. 🍒
              </p>
            </div>
          ) : (
            <>
              {/*
               * As entregas do dia já encerraram.
               *
               * Só aparece em doce de PRONTA ENTREGA: quando o carrinho tem
               * encomenda, quem manda no prazo são os dias de preparo, e falar
               * do horário de hoje ali só confundiria.
               */}
              {entregaSoAmanha && prazoDias === 0 && (
                <p className="text-sm font-body text-cherryDark bg-blush/60 border border-cherryLight/50 rounded-xl px-4 py-3 mt-2">
                  {entregaSoAmanha}
                </p>
              )}
              <p className="text-sm font-body text-ink/70 bg-white/60 border border-cherryLight/30 rounded-xl px-4 py-3 mt-2">
                {prazoDias > 0
                  ? `Um dos doces do seu carrinho é feito sob encomenda e precisa de ${prazoDias} ${prazoDias === 1 ? "dia" : "dias"} de preparo. A Camily combina o dia e o horário da entrega com você pelo WhatsApp.`
                  : "A Camily combina o dia e o horário da entrega com você pelo WhatsApp, assim que o pagamento for confirmado."}
              </p>
            </>
          )}
        </section>

        <CherryDivider />

        {/* Presente e bilhete: os dois começam fechados porque a maioria das
            compras é pra própria pessoa — só abre quem precisa. */}
        <section className="grid gap-3">
          <h2 className="font-display text-lg text-ink">É um presente?</h2>

          <label className="flex items-start gap-2.5 font-body text-sm text-ink/80">
            <input
              type="checkbox"
              checked={ehPresente}
              onChange={(e) => setEhPresente(e.target.checked)}
              className="w-5 h-5 mt-0.5 accent-cherryDark shrink-0"
            />
            <span>
              Sim, é presente para outra pessoa
              <span className="block text-xs text-ink/50">
                A Camily leva no nome de quem vai receber.
              </span>
            </span>
          </label>

          {ehPresente && (
            <label className="grid gap-1 text-sm font-body text-ink/80">
              Nome de quem vai receber
              <input
                value={nomeQuemRecebe}
                onChange={(e) => setNomeQuemRecebe(e.target.value)}
                placeholder="Ex: Ana Paula"
                className="w-full border border-cherryLight/60 rounded-xl px-4 py-2.5 bg-white/70 focus:outline-none focus:ring-2 focus:ring-cherryDark"
              />
            </label>
          )}

          <label className="flex items-start gap-2.5 font-body text-sm text-ink/80">
            <input
              type="checkbox"
              checked={querBilhete}
              onChange={(e) => setQuerBilhete(e.target.checked)}
              className="w-5 h-5 mt-0.5 accent-cherryDark shrink-0"
            />
            <span>
              Quero enviar um bilhete junto
              <span className="block text-xs text-ink/50">
                A Camily escreve à mão num cartãozinho e manda com o doce.
              </span>
            </span>
          </label>

          {querBilhete && (
            <label className="grid gap-1 text-sm font-body text-ink/80">
              Sua mensagem
              <textarea
                value={bilhete}
                onChange={(e) => setBilhete(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Feliz aniversário! Que seu dia seja tão doce quanto você. 🍒"
                className="w-full border border-cherryLight/60 rounded-xl px-4 py-2.5 bg-white/70 focus:outline-none focus:ring-2 focus:ring-cherryDark"
              />
              <span className="text-xs text-ink/45">
                {bilhete.length}/500 — escrito à mão, então caprichamos no que
                couber no cartão.
              </span>
            </label>
          )}
        </section>

        <CherryDivider />

        <section className="grid gap-3">
          <h2 className="font-display text-lg text-ink">Forma de pagamento</h2>
          {/*
            Aqui só INFORMA quais formas existem — quem escolhe é o botão de
            pagar, lá embaixo. Ter a escolha nos dois lugares fazia a pessoa
            decidir duas vezes: uma aqui e outra dentro do Mercado Pago.

            O débito não aparece porque o Mercado Pago não o oferece no
            Checkout, só na maquininha e no Tap.
          */}
          <p className="text-sm font-body text-ink/70">
            <strong className="text-ink/85">Pix</strong>
            {descontoPix > 0 && (
              <span className="text-green-700 font-semibold">
                {" "}
                (com {percentualEscrito(percentualPix)} de desconto)
              </span>
            )}{" "}
            ou <strong className="text-ink/85">cartão de crédito à vista</strong>.
            Você escolhe no botão de pagar, no fim da página — e paga no
            ambiente seguro do Mercado Pago.
          </p>
          <p className="text-xs text-ink/50">Não trabalhamos com parcelamento.</p>
        </section>

        <CherryDivider />

        {/* Cupom: a Camily já criava cupons no painel, mas não havia onde
            digitar o código — eles não serviam pra nada. Fica recolhido
            porque a maioria das compras não usa um. */}
        <section className="grid gap-2">
          {!mostrarCupom && !cupomAplicado ? (
            <button
              onClick={() => setMostrarCupom(true)}
              className="text-sm font-body text-cherryDark underline justify-self-start inline-flex items-center min-h-[44px]"
            >
              Tenho um cupom de desconto
            </button>
          ) : cupomAplicado ? (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 grid gap-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-body text-sm text-green-800">
                  Cupom <strong>{cupomAplicado.codigo}</strong> aplicado — você
                  economizou {reais(cupomAplicado.desconto)}. 🍒
                </span>
                <button
                  onClick={tirarCupom}
                  className="font-body text-xs text-ink/50 underline inline-flex items-center min-h-[44px]"
                >
                  Tirar
                </button>
              </div>
              {/* Sem este aviso, a pessoa vê um desconto menor do que esperava
                  e acha que o cupom veio errado. */}
              {cupomAplicado.valeuEmParte && (
                <span className="font-body text-xs text-green-800/80">
                  O desconto valeu só nos doces fora de promoção — os que já
                  estão em oferta não acumulam cupom.
                </span>
              )}
            </div>
          ) : (
            <div className="grid gap-2">
              <label className="grid gap-1 text-sm font-body text-ink/80">
                Código do cupom
                <div className="flex gap-2">
                  <input
                    value={codigoCupom}
                    onChange={(e) => {
                      setCodigoCupom(e.target.value.toUpperCase());
                      setErroCupom("");
                    }}
                    placeholder="EX: DOCE10"
                    autoCapitalize="characters"
                    className="min-w-0 flex-1 border border-cherryLight/60 rounded-xl px-4 py-2.5 bg-white/70 focus:outline-none focus:ring-2 focus:ring-cherryDark"
                  />
                  <button
                    onClick={aplicarCupom}
                    disabled={conferindoCupom || !codigoCupom.trim()}
                    className="shrink-0 bg-cherryDark text-white rounded-full px-5 py-3 font-body font-semibold text-sm disabled:opacity-40"
                  >
                    {conferindoCupom ? "..." : "Aplicar"}
                  </button>
                </div>
              </label>
              {erroCupom && (
                <p className="text-sm font-body text-cherryDark">{erroCupom}</p>
              )}
            </div>
          )}
        </section>

        <CherryDivider />

        <div className="grid gap-1 font-body">
          <div className="flex justify-between gap-3">
            <span>Subtotal</span>
            <span className="tabular-nums">{reais(subtotal)}</span>
          </div>
          {cupomAplicado && (
            <div className="flex justify-between gap-3 text-green-700">
              <span>Desconto ({cupomAplicado.codigo})</span>
              <span className="tabular-nums">− {reais(cupomAplicado.desconto)}</span>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <span>{tipoEntrega === "retirada" ? "Retirada" : "Frete"}</span>
            <span
              className={`tabular-nums ${
                tipoEntrega === "entrega" && frete?.gratisPorValor
                  ? "text-green-700 font-semibold"
                  : ""
              }`}
            >
              {tipoEntrega === "retirada" || valorFrete === 0
                ? "Grátis"
                : reais(valorFrete)}
            </span>
          </div>
          <div className="flex justify-between gap-3 font-display text-lg mt-2">
            <span>Total</span>
            <span className="tabular-nums">{reais(total)}</span>
          </div>
        </div>

        {/*
         * A forma de pagamento É o botão de pagar.
         *
         * Antes havia uma seção "Forma de pagamento" aqui em cima e um botão
         * "Ir para o pagamento" — e a pessoa escolhia tudo de novo dentro do
         * Mercado Pago. Agora ela aperta direto o que quer, o Checkout abre
         * travado naquela forma, e o desconto do Pix já aparece no valor do
         * botão, antes de sair do site.
         */}
        {/* Loja fechada: o aviso toma o lugar dos botões de pagar. Deixá-los
            ali só pra dar erro no toque seria pior do que explicar antes. */}
        {pix ? (
          /* Pix gerado sem sair do site: QR na tela e o copia-e-cola à mão. */
          <div className="mt-6 bg-white/70 border border-cherryLight/50 rounded-2xl p-5 text-center">
            <p className="font-display text-lg text-cherryDark">Pix gerado! 🍒</p>
            <p className="font-body text-sm text-ink/70 mt-1">
              Escaneie o código ou copie o texto. Assim que o pagamento cair, seu
              pedido entra na fila da Camily.
            </p>

            {pix.qrCodeBase64 && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={`data:image/png;base64,${pix.qrCodeBase64}`}
                alt="QR code do Pix"
                className="w-56 h-56 mx-auto mt-4 rounded-xl border border-cherryLight/40 bg-white"
              />
            )}

            {pix.copiaECola && (
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(pix.copiaECola ?? "");
                  setCopiado(true);
                  setTimeout(() => setCopiado(false), 2500);
                }}
                className="mt-4 w-full bg-cherryDark text-white rounded-full px-5 min-h-[44px] font-body font-semibold text-sm hover:bg-cherryMid transition-colors"
              >
                {copiado ? "Copiado! 🍒" : "Copiar código do Pix"}
              </button>
            )}

            <Link
              href="/conta"
              className="block mt-3 font-body text-sm text-cherryDark underline min-h-[44px] leading-[44px]"
            >
              Ver meus pedidos
            </Link>
          </div>
        ) : pagarAqui ? (
          /* O formulário do Mercado Pago, dentro da nossa página. */
          <PagamentoNoSite
            pedidoId={pagarAqui.pedidoId}
            total={pagarAqui.total}
            chavePublica={CHAVE_MP}
            aoConfirmar={(r) => {
              if (r.pix?.copiaECola || r.pix?.qrCodeBase64) {
                setPix(r.pix);
                salvarCarrinho([]);
                return;
              }
              // Cartão aprovado (ou em análise): a tela de sempre cuida do resto.
              window.location.href = `/pedido/sucesso?status=${encodeURIComponent(
                r.situacao
              )}&external_reference=${pagarAqui.pedidoId}`;
            }}
          />
        ) : lojaFechadaPraMim ? (
          <div className="mt-6 bg-blush/70 border border-cherryLight/60 rounded-2xl p-5 text-center">
            <p className="font-display text-lg text-cherryDark">
              A loja está fechada agora 🌙
            </p>
            <p className="font-body text-sm text-ink/75 mt-2">{lojaFechadaPraMim}</p>
            <p className="font-body text-xs text-ink/55 mt-2">
              Seu carrinho fica guardado do jeito que está.
            </p>
          </div>
        ) : soTemPremio ? (
          /* Prêmio sozinho não fecha pedido — o aviso toma o lugar dos botões,
             com a saída à mão em vez de só a má notícia. */
          <div className="mt-6 bg-blush/70 border border-cherryLight/60 rounded-2xl p-5 text-center">
            <p className="font-display text-lg text-cherryDark">
              Falta um doce para levar o prêmio 🍒
            </p>
            <p className="font-body text-sm text-ink/75 mt-2">
              O prêmio vai junto com um pedido. Escolha pelo menos um doce e ele sai na
              mesma entrega.
            </p>
            <Link
              href="/catalogo"
              className="inline-flex items-center justify-center mt-4 bg-cherryDark text-white rounded-full px-6 py-3 font-body font-semibold text-sm hover:bg-cherryMid transition-colors"
            >
              Ver o cardápio
            </Link>
          </div>
        ) : semCobranca ? (
          <div className="mt-6">
            <button
              onClick={() => handleFinalizar("pix")}
              disabled={pagamentoBloqueado}
              className="w-full bg-cherryDark text-white rounded-2xl px-5 py-4 font-body hover:bg-cherryMid transition-colors disabled:opacity-40"
            >
              <span className="font-semibold">
                {finalizando ? "Confirmando..." : "Confirmar pedido"}
              </span>
              <span className="block text-xs text-white/80 mt-0.5">
                Seu desconto cobriu tudo — não tem nada a pagar. 🍒
              </span>
            </button>
          </div>
        ) : (
        <div className="mt-6 grid gap-2">
          {/*
            Pagar aqui dentro (Payment Brick).
            Só aparece quando a chave pública do Mercado Pago está configurada,
            então o site funciona igual sem ela — e o caminho de sempre, que é
            o que está vendendo, continua logo abaixo.
          */}
          {CHAVE_MP && (
            <button
              onClick={pagarSemSair}
              disabled={pagamentoBloqueado}
              className="w-full bg-cherryDark text-white rounded-2xl px-5 py-4 font-body hover:bg-cherryMid transition-colors disabled:opacity-40 text-left"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="font-semibold">
                  {finalizando ? "Abrindo..." : "Pagar aqui mesmo"}
                </span>
                <span className="font-display text-lg tabular-nums">
                  {reais(total - descontoPix)}
                </span>
              </span>
              <span className="block text-xs text-white/80 mt-0.5">
                Pix ou cartão sem sair da Doceterapia.
              </span>
            </button>
          )}

          {/* O Pix está sempre aqui: é forma de pagamento, não promoção. O
              desconto só muda o valor e a linha de baixo. */}
          <button
            onClick={() => handleFinalizar("pix")}
            disabled={pagamentoBloqueado}
            className="w-full bg-cherryDark text-white rounded-2xl px-5 py-4 font-body hover:bg-cherryMid transition-colors disabled:opacity-40 text-left"
          >
            <span className="flex items-center justify-between gap-3">
              <span className="font-semibold">
                {finalizando === "pix" ? "Abrindo o Pix..." : "Pagar com Pix"}
              </span>
              <span className="font-display text-lg tabular-nums">
                {reais(total - descontoPix)}
              </span>
            </span>
            <span className="flex items-center justify-between gap-3 text-xs text-white/80 mt-0.5">
              <span>
                {descontoPix > 0
                  ? `${percentualEscrito(percentualPix)} de desconto — você economiza ${reais(descontoPix)}`
                  : "O pagamento cai na hora."}
              </span>
              {/* O valor cheio riscado, pra diferença ficar evidente. */}
              {descontoPix > 0 && (
                <span className="line-through tabular-nums">{reais(total)}</span>
              )}
            </span>
          </button>

          <button
            onClick={() => handleFinalizar("credito")}
            disabled={pagamentoBloqueado}
            className="w-full rounded-2xl px-5 py-4 font-body transition-colors disabled:opacity-40 text-left bg-white/70 border border-cherryDark/30 text-ink hover:border-cherryDark"
          >
            <span className="flex items-center justify-between gap-3">
              <span className="font-semibold">
                {finalizando === "credito"
                  ? "Abrindo o cartão..."
                  : "Pagar com cartão de crédito"}
              </span>
              <span className="font-display text-lg tabular-nums">{reais(total)}</span>
            </span>
            <span className="block text-xs mt-0.5 text-ink/55">
              À vista, sem parcelamento.
            </span>
          </button>
        </div>
        )}

        <p className="text-xs text-ink/50 text-center mt-2 font-body">
          {fechada
            ? "O horário de atendimento é o mesmo todos os dias."
            : compraBloqueada && !carregandoFrete
            ? enderecoEmBranco || enderecoIncompleto
              ? "Complete o endereço acima (ou escolha Retirada) para continuar."
              : "Para continuar, escolha Retirada acima."
            : cliente === null && !carregandoCliente
              ? "Você entra (ou cria sua conta em 1 minuto) e volta direto pra cá, com o carrinho do jeito que está."
              : "Você paga no ambiente seguro do Mercado Pago, já na forma que escolher aqui."}
        </p>
      </main>
      <RodapeLinks />
    </>
  );
}

function BotaoWhatsApp({ mensagem }: { mensagem: string }) {
  const { linkWhatsApp } = useSobre();
  return (
    <a
      href={linkWhatsApp(mensagem)}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 inline-flex items-center gap-2 bg-[#25D366] text-white rounded-full px-5 py-2.5 font-body font-semibold text-sm hover:brightness-95 transition"
    >
      <IconeWhatsApp className="w-4 h-4" />
      Falar com a Camily no WhatsApp
    </a>
  );
}

function AvisoFrete({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-body text-cherryDark bg-blush/70 border border-cherryLight/50 rounded-xl px-4 py-3">
      {children}
    </p>
  );
}

function OpcaoBotao({
  ativo,
  onClick,
  label,
}: {
  ativo: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-3 rounded-full text-sm font-body border transition-colors ${
        ativo
          ? "bg-cherryDark text-white border-cherryDark"
          : "bg-white/70 text-ink/70 border-cherryLight/50"
      }`}
    >
      {label}
    </button>
  );
}
