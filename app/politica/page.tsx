import Link from "next/link";
import CherryDivider from "@/components/CherryDivider";
import { linkWhatsAppNumero } from "@/lib/contato";
import { getConfigLoja, sobreDaLoja } from "@/lib/config-loja";
import { textosDaPolitica } from "@/lib/politica";

/**
 * Sem isto o Next congela a página no build, com o telefone e os textos que
 * existiam naquele minuto — e o que a Camily mudasse no painel não apareceria
 * até o próximo deploy.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Política de cancelamento e reembolso — Doceterapia",
  description:
    "Como funcionam cancelamento, reembolso, entrega, retirada, pagamento e prazos dos doces sob encomenda da Doceterapia.",
};

/**
 * Página pública com as regras da loja. Fica fora do middleware de login de
 * propósito: quem ainda não tem conta precisa poder ler antes de comprar.
 *
 * O texto é a Camily falando na primeira pessoa, que é como ela conversa com
 * as clientes no WhatsApp — e ela edita tudo em `/admin/politica`. Aqui só
 * mora a estrutura e os links.
 */
export default async function PoliticaPage() {
  const config = await getConfigLoja();
  const { telefone } = sobreDaLoja(config);
  const texto = textosDaPolitica(config.politica);
  const linkWhatsApp = (mensagem?: string) => linkWhatsAppNumero(telefone, mensagem);

  return (
    <main className="min-h-screen px-4 sm:px-6 md:px-12 py-8 md:py-10 max-w-2xl mx-auto">
      <Link
        href="/catalogo"
        className="text-sm text-cherryDark underline font-body py-3 inline-block"
      >
        ← Voltar ao cardápio
      </Link>

      <h1 className="font-display text-2xl sm:text-3xl text-cherryDark mt-2">
        Política de cancelamento, reembolso e entrega
      </h1>
      <div className="font-body text-ink/60 text-sm mt-2 grid gap-2">
        <Paragrafos texto={texto.intro} />
        <p>
          Se ficar qualquer dúvida,{" "}
          <a
            href={linkWhatsApp("Oi, Camily! Tenho uma dúvida sobre a política da loja.")}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cherryDark underline"
          >
            me chame no WhatsApp {telefone}
          </a>
          . Eu respondo pessoalmente.
        </p>
      </div>
      <CherryDivider />

      <Secao titulo="Cancelamento do pedido">
        <Paragrafos texto={texto.cancelamentoIntro} />

        <div className="grid gap-3 mt-1">
          <Etapa titulo="Aguardando pagamento ou Pagamento confirmado">
            <Paragrafos texto={texto.etapaAguardando} />
            <p className="mt-1">
              É só ir em{" "}
              <Link href="/conta" className="text-cherryDark underline">
                Minha conta
              </Link>
              .
            </p>
          </Etapa>

          <Etapa titulo="Em preparo">
            <Paragrafos texto={texto.etapaPreparo} />
            <p className="mt-1">
              <a
                href={linkWhatsApp(
                  "Oi, Camily! Preciso cancelar um pedido que ainda está em preparo. Consegue me ajudar?"
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cherryDark underline"
              >
                Falar com a Camily no WhatsApp
              </a>
            </p>
          </Etapa>

          <Etapa titulo="A caminho ou Entregue" ultimo>
            <Paragrafos texto={texto.etapaEntregue} />
            <p className="mt-1">
              <a
                href={linkWhatsApp(
                  "Oi, Camily! Recebi meu pedido e tem uma coisa que não ficou certa. Posso te mostrar?"
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cherryDark underline"
              >
                Me chamar no WhatsApp
              </a>
            </p>
          </Etapa>
        </div>
      </Secao>

      <Secao titulo="Devolução do dinheiro">
        <Paragrafos texto={texto.devolucao} />
        <Paragrafos texto={texto.prazosDoEstorno} />
      </Secao>

      <Secao titulo="Entrega e retirada">
        <Paragrafos texto={texto.entregaRetirada} />
      </Secao>

      <Secao titulo="Doces sob encomenda">
        <Paragrafos texto={texto.sobEncomenda} />
      </Secao>

      <Secao titulo="Formas de pagamento">
        <Paragrafos texto={texto.pagamento} />
      </Secao>

      <Secao titulo="Seus dados">
        <Paragrafos texto={texto.dados} />
      </Secao>

      <Secao titulo="Avaliações">
        <Paragrafos texto={texto.avaliacoes} />
      </Secao>

      <div className="bg-white/70 border border-cherryLight/30 rounded-2xl p-5 mt-8 text-center font-body">
        <p className="text-ink/70 text-sm">
          Ficou com dúvida sobre alguma coisa daqui?
        </p>
        <a
          href={linkWhatsApp("Oi, Camily! Tenho uma dúvida sobre a política da loja.")}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-3 bg-cherryDark text-white rounded-full px-6 py-3 font-semibold"
        >
          Falar com a Camily
        </a>
        <p className="text-xs text-ink/45 mt-3">
          Doceterapia — doces artesanais da Camily Vilasboa, Arapongas-PR.
        </p>
      </div>
    </main>
  );
}

/**
 * Transforma o texto que a Camily digitou em parágrafos — e em lista quando
 * as linhas começam com "- ". É o mínimo de formatação que ela precisa sem
 * ter que aprender nada: linha em branco separa parágrafo, traço vira item.
 */
function Paragrafos({ texto }: { texto: string }) {
  const blocos = texto
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  return (
    <>
      {blocos.map((bloco, i) => {
        const linhas = bloco.split("\n").map((l) => l.trim()).filter(Boolean);
        const ehLista = linhas.every((l) => l.startsWith("- "));

        if (ehLista) {
          return (
            <ul key={i} className="list-disc pl-5 grid gap-1">
              {linhas.map((l, j) => (
                <li key={j}>{destacarInicio(l.slice(2))}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{destacarInicio(bloco)}</p>;
      })}
    </>
  );
}

/**
 * Deixa em negrito o comecinho de linhas escritas como "Rótulo: explicação"
 * — é o que dá ritmo em "Pix: cai em minutos" e "Entrega: só em Arapongas".
 * Só vale para rótulo curto, senão uma frase com dois-pontos no meio sairia
 * metade em negrito.
 */
function destacarInicio(texto: string) {
  const corte = texto.indexOf(":");
  if (corte > 0 && corte <= 28 && !texto.slice(0, corte).includes(" ,")) {
    return (
      <>
        <strong>{texto.slice(0, corte + 1)}</strong>
        {texto.slice(corte + 1)}
      </>
    );
  }
  return texto;
}

/**
 * Uma etapa do caminho do pedido, na regra de cancelamento.
 *
 * Vira uma linha do tempo de propósito: o que decide se dá pra cancelar é
 * ONDE o pedido está, e ver as três fases em ordem responde a pergunta mais
 * rápido do que três parágrafos seguidos. A cereja marca o ponto de cada
 * etapa, e o fiozinho liga uma na outra (o último não tem, senão o traço
 * fica sobrando no ar).
 */
function Etapa({
  titulo,
  children,
  ultimo,
}: {
  titulo: string;
  children: React.ReactNode;
  ultimo?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center pt-1 shrink-0">
        <span aria-hidden className="text-sm leading-none">
          🍒
        </span>
        {!ultimo && <span className="w-px flex-1 bg-cherryLight/50 mt-1" />}
      </div>
      <div className={`min-w-0 grid gap-2 ${ultimo ? "" : "pb-1"}`}>
        <p className="font-display text-base text-cherryDark">{titulo}</p>
        {children}
      </div>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="font-display text-lg sm:text-xl text-cherryDark">{titulo}</h2>
      <div className="grid gap-3 font-body text-sm text-ink/75 mt-2 leading-relaxed">
        {children}
      </div>
    </section>
  );
}
