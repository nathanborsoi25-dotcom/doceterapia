"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import CherryDivider from "@/components/CherryDivider";
import RodapeLinks from "@/components/RodapeLinks";
import EnderecoVisitante from "@/components/EnderecoVisitante";
import { reais } from "@/lib/formato";
import { getCarrinho, type EnderecoVisitante as EnderecoDeVisitante } from "@/lib/store";
import {
  getClienteLogado,
  getConfiguracaoFrete,
  getProdutos,
  iniciarPagamento,
} from "@/lib/api";
import {
  dataMinimaRetirada,
  paraInputDataHora,
  prazoMaximoEmDias,
} from "@/lib/prazo";
import type { Cliente } from "@/lib/types";
import { calcularFretePorEndereco } from "@/lib/shipping";
import { checarAreaEntrega } from "@/lib/area-entrega";
import { linkWhatsApp } from "@/lib/contato";
import type { ConfiguracaoFrete, FormaPagamento, TipoEntrega } from "@/lib/types";

export default function CheckoutPage() {
  const [tipoEntrega, setTipoEntrega] = useState<TipoEntrega>("entrega");
  const [dataAgendada, setDataAgendada] = useState("");
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>("pix");
  const [frete, setFrete] = useState<{ distanciaKm: number; valor: number | null } | null>(null);
  const [config, setConfig] = useState<ConfiguracaoFrete | null>(null);
  const [finalizando, setFinalizando] = useState(false);

  const carrinho = useMemo(() => getCarrinho(), []);
  // O cliente vem da sessão no servidor, não do navegador: assim o endereço
  // usado no frete é o que está de fato cadastrado na conta.
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [carregandoCliente, setCarregandoCliente] = useState(true);
  // Endereço de quem ainda não criou conta, só pra ver o frete.
  const [enderecoVisitante, setEnderecoVisitante] = useState<EnderecoDeVisitante | null>(null);
  const subtotal = carrinho.reduce((acc, i) => acc + i.precoUnitario * i.quantidade, 0);

  // Dias de encomenda do carrinho: o prazo vem do produto no banco, não do
  // carrinho salvo no navegador (que pode estar desatualizado).
  const [prazoDias, setPrazoDias] = useState(0);

  useEffect(() => {
    getConfiguracaoFrete()
      .then(setConfig)
      .catch(() => setConfig(null));
    getClienteLogado()
      .then(setCliente)
      .catch(() => setCliente(null))
      .finally(() => setCarregandoCliente(false));
    getProdutos()
      .then((lista) => {
        const noCarrinho = new Set(carrinho.map((i) => i.produtoId));
        setPrazoDias(
          prazoMaximoEmDias(
            lista.filter((p) => noCarrinho.has(p.id)).map((p) => p.prazoDias)
          )
        );
      })
      .catch(() => setPrazoDias(0));
  }, [carrinho]);

  const minimoRetirada = useMemo(
    () => paraInputDataHora(dataMinimaRetirada(prazoDias)),
    [prazoDias]
  );

  /**
   * O endereço que vale nesta tela: o do cadastro quando a pessoa está
   * logada, o digitado aqui quando ainda não está. Os dois calculam o frete
   * do mesmo jeito — o que muda é que, na hora de fechar o pedido, o servidor
   * usa SEMPRE o do cadastro (o único que ninguém consegue forjar).
   */
  const enderecoAtual = useMemo(() => {
    if (cliente) return cliente.endereco;
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
  }, [cliente, enderecoVisitante]);

  /** Endereço ainda em branco: a pessoa nem começou a preencher. */
  const enderecoEmBranco =
    !enderecoAtual || (!enderecoAtual.rua && !enderecoAtual.cep);
  /** Começou mas ainda falta rua ou número — não é erro, é digitação em curso. */
  const enderecoIncompleto =
    !enderecoEmBranco && (!enderecoAtual?.rua || !enderecoAtual?.numero);

  useEffect(() => {
    if (tipoEntrega !== "entrega" || !enderecoAtual || !config) return;
    if (enderecoAtual.lat && enderecoAtual.lng) {
      setFrete(calcularFretePorEndereco(enderecoAtual.lat, enderecoAtual.lng, config));
    } else {
      setFrete(null);
    }
  }, [tipoEntrega, enderecoAtual, config]);

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
  const compraBloqueada = tipoEntrega === "entrega" && (!area.atendido || freteIndisponivel);

  const valorFrete = tipoEntrega === "retirada" ? 0 : frete?.valor ?? 0;
  const total = subtotal + valorFrete;

  async function handleFinalizar() {
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

    setFinalizando(true);
    try {
      // Cria o pedido e inicia o pagamento no Mercado Pago.
      const { url } = await iniciarPagamento({
        clienteId: cliente?.id ?? "",
        itens: carrinho,
        tipoEntrega,
        dataAgendada,
        enderecoEntrega: tipoEntrega === "entrega" ? cliente?.endereco : undefined,
        valorFrete,
        formaPagamento,
      });
      if (url) {
        // Redireciona para o checkout seguro do Mercado Pago (Pix/cartão).
        window.location.href = url;
      } else {
        alert("Não foi possível iniciar o pagamento. Tente novamente.");
        setFinalizando(false);
      }
    } catch (e) {
      alert(
        e instanceof Error && e.message
          ? e.message
          : "Não foi possível iniciar o pagamento. Verifique sua conexão e tente novamente."
      );
      setFinalizando(false);
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
          <div className="bg-blush/70 border border-cherryLight/60 rounded-cherry p-5 mb-6 text-center">
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
              {cliente ? (
                <>
                  <p className="text-sm font-body text-ink/80">
                    <strong>Entregar em:</strong> {cliente.endereco.rua},{" "}
                    {cliente.endereco.numero}
                    {cliente.endereco.bairro && ` — ${cliente.endereco.bairro}`}
                    {cliente.endereco.cidade && `, ${cliente.endereco.cidade}`}
                  </p>
                  <a
                    href="/conta"
                    className="text-sm text-cherryDark underline justify-self-start py-1"
                  >
                    Mudar meu endereço
                  </a>
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
              <p className="text-sm font-body text-ink/70">
                Distância até você: {frete.distanciaKm} km — frete:{" "}
                {reais(frete.valor ?? 0)}
              </p>
            ) : null)}

          {/* Só a RETIRADA é agendada pelo cliente. Na entrega quem marca a
              data é a Camily, então aqui a gente só avisa o prazo. */}
          {tipoEntrega === "retirada" ? (
            <>
              <label className="grid gap-1 text-sm font-body text-ink/80 mt-2">
                Quando você vem buscar? *
                <input
                  type="datetime-local"
                  value={dataAgendada}
                  min={minimoRetirada}
                  onChange={(e) => setDataAgendada(e.target.value)}
                  className="w-full border border-cherryLight/60 rounded-xl px-4 py-2.5 bg-white/70 focus:outline-none focus:ring-2 focus:ring-cherryDark"
                />
              </label>
              <p className="text-xs text-ink/50 -mt-1">
                {prazoDias > 0
                  ? `Um dos doces do seu carrinho é feito sob encomenda e precisa de ${prazoDias} ${prazoDias === 1 ? "dia" : "dias"} de preparo, então a retirada começa em ${new Date(minimoRetirada).toLocaleDateString("pt-BR")}.`
                  : "Tudo do seu carrinho é pronta entrega — você já pode buscar hoje."}
              </p>
            </>
          ) : (
            <p className="text-sm font-body text-ink/70 bg-white/60 border border-cherryLight/30 rounded-xl px-4 py-3 mt-2">
              {prazoDias > 0
                ? `Um dos doces do seu carrinho é feito sob encomenda e precisa de ${prazoDias} ${prazoDias === 1 ? "dia" : "dias"} de preparo. A Camily combina o dia e o horário da entrega com você pelo WhatsApp.`
                : "A Camily combina o dia e o horário da entrega com você pelo WhatsApp, assim que o pagamento for confirmado."}
            </p>
          )}
        </section>

        <CherryDivider />

        <section className="grid gap-3">
          <h2 className="font-display text-lg text-ink">Forma de pagamento</h2>
          <div className="flex gap-3 flex-wrap">
            {(["pix", "credito", "debito"] as FormaPagamento[]).map((forma) => (
              <OpcaoBotao
                key={forma}
                ativo={formaPagamento === forma}
                onClick={() => setFormaPagamento(forma)}
                label={forma === "pix" ? "Pix" : forma === "credito" ? "Crédito à vista" : "Débito"}
              />
            ))}
          </div>
          <p className="text-xs text-ink/50">Não trabalhamos com parcelamento.</p>
        </section>

        <CherryDivider />

        <div className="grid gap-1 font-body">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{reais(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Frete</span>
            <span>{reais(valorFrete)}</span>
          </div>
          <div className="flex justify-between font-display text-lg mt-2">
            <span>Total</span>
            <span>{reais(total)}</span>
          </div>
        </div>

        <button
          onClick={handleFinalizar}
          disabled={
            (tipoEntrega === "retirada" && !dataAgendada) ||
            finalizando ||
            compraBloqueada
          }
          className="mt-6 w-full bg-cherryDark text-white rounded-full py-3 font-body font-semibold hover:bg-cherryMid transition-colors disabled:opacity-40"
        >
          {finalizando
            ? "Redirecionando para o pagamento..."
            : cliente === null && !carregandoCliente
              ? "Entrar e finalizar o pedido"
              : "Ir para o pagamento"}
        </button>
        <p className="text-xs text-ink/50 text-center mt-2 font-body">
          {compraBloqueada && !carregandoFrete
            ? enderecoEmBranco || enderecoIncompleto
              ? "Complete o endereço acima (ou escolha Retirada) para continuar."
              : "Para continuar, escolha Retirada acima."
            : cliente === null && !carregandoCliente
              ? "Você entra (ou cria sua conta em 1 minuto) e volta direto pra cá, com o carrinho do jeito que está."
              : "Você será levado ao ambiente seguro do Mercado Pago para pagar com Pix ou cartão."}
        </p>
      </main>
      <RodapeLinks />
    </>
  );
}

function BotaoWhatsApp({ mensagem }: { mensagem: string }) {
  return (
    <a
      href={linkWhatsApp(mensagem)}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 inline-flex items-center gap-2 bg-[#25D366] text-white rounded-full px-5 py-2.5 font-body font-semibold text-sm hover:brightness-95 transition"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="w-4 h-4 fill-current">
        <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.76-1.66-2.06-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.38-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35z" />
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.02h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.37c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.41a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.22-8.24 8.22z" />
      </svg>
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
