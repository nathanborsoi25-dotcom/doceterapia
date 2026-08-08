import Link from "next/link";
import CherryDivider from "@/components/CherryDivider";
import { linkWhatsAppNumero } from "@/lib/contato";
import { getConfigLoja, sobreDaLoja } from "@/lib/config-loja";

/**
 * Sem isto o Next congela a página no build, com o telefone que existia
 * naquele minuto — e trocar o número pelo painel não mudaria nada aqui até o
 * próximo deploy.
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
 * O texto foi escrito com a Camily falando na primeira pessoa, que é como ela
 * conversa com as clientes no WhatsApp.
 */
export default async function PoliticaPage() {
  // O telefone vem do painel: se a Camily trocar de número, a política troca
  // junto — em vez de virar um número velho escrito na pedra.
  const { telefone } = sobreDaLoja(await getConfigLoja());
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
      <p className="font-body text-ink/60 text-sm mt-2">
        Aqui está tudo combinado por escrito, pra você comprar tranquila. Se
        ficar qualquer dúvida,{" "}
        <a
          href={linkWhatsApp("Oi, Camily! Tenho uma dúvida sobre a política da loja.")}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cherryDark underline"
        >
          me chame no WhatsApp {telefone}
        </a>{" "}
        — eu respondo pessoalmente.
      </p>
      <CherryDivider />

      <Secao titulo="Cancelamento do pedido">
        <p>
          A regra é uma só, e ela acompanha o caminho dos seus doces:{" "}
          <strong>
            dá pra cancelar e receber o dinheiro de volta enquanto o pedido não
            saiu da minha cozinha
          </strong>
          . Depois que ele sai, não.
        </p>

        <div className="grid gap-3 mt-1">
          <Etapa titulo="Aguardando pagamento ou Pagamento confirmado">
            Você cancela sozinha, na hora, em{" "}
            <Link href="/conta" className="text-cherryDark underline">
              Minha conta
            </Link>
            . Se já tinha pago, o valor volta inteiro.
          </Etapa>

          <Etapa titulo="Em preparo">
            Os doces já estão sendo feitos, então o cancelamento passa por mim —
            mas ainda dá.{" "}
            <a
              href={linkWhatsApp(
                "Oi, Camily! Preciso cancelar um pedido que ainda está em preparo. Consegue me ajudar?"
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cherryDark underline"
            >
              Me chame no WhatsApp
            </a>{" "}
            que eu cancelo e devolvo o valor.
          </Etapa>

          <Etapa titulo="A caminho ou Entregue" ultimo>
            <strong>A caminho</strong> quer dizer que o pedido saiu para entrega
            — ou que já está pronto esperando você buscar. Daqui em diante não
            há mais cancelamento nem devolução: é alimento fresco, feito sob
            medida pra você, e depois que sai da minha mão eu não consigo
            aproveitar de novo.
            <br />
            Mas se chegou alguma coisa errada, estragada ou fora do que a gente
            combinou,{" "}
            <a
              href={linkWhatsApp(
                "Oi, Camily! Recebi meu pedido e tem uma coisa que não ficou certa. Posso te mostrar?"
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cherryDark underline"
            >
              <strong>me chame no mesmo dia com uma foto</strong>
            </a>
            . Eu olho cada caso com você e a gente acerta — nunca deixei ninguém
            na mão até hoje.
          </Etapa>
        </div>
      </Secao>

      <Secao titulo="Devolução do dinheiro">
        <p>
          Nos casos acima em que o cancelamento vale, o estorno é pedido ao
          Mercado Pago na mesma hora, pelo <strong>valor total</strong> (doces +
          entrega, menos o desconto que tiver sido usado). Você não precisa
          pedir nada: sai junto com o cancelamento.
        </p>
        <ul className="list-disc pl-5 grid gap-1">
          <li>
            <strong>Pix:</strong> o valor costuma voltar para a sua conta em
            minutos, e no máximo em alguns dias úteis.
          </li>
          <li>
            <strong>Cartão de crédito:</strong> o estorno aparece na fatura —
            dependendo da data de fechamento, pode ser só na fatura seguinte.
            Quem define esse prazo é o banco, não eu.
          </li>
          <li>
            <strong>Cartão de débito:</strong> costuma voltar para a conta em
            poucos dias úteis.
          </li>
        </ul>
        <p>
          Se por algum motivo o estorno automático não sair, eu sou avisada na
          hora e falo com você pelo WhatsApp pra devolver por Pix.
        </p>
      </Secao>

      <Secao titulo="Entrega e retirada">
        <p>
          <strong>Entrega:</strong> por enquanto entrego somente em{" "}
          <strong>Arapongas-PR</strong> (CEPs de 86700-000 a 86709-999). O valor
          da entrega é calculado pela distância entre a minha cozinha e o seu
          endereço, e aparece no carrinho antes de você pagar. A entrega é feita
          por aplicativo, e a data e o horário eu combino com você pelo WhatsApp.
        </p>
        <p>
          <strong>Retirada:</strong> quem é de fora de Arapongas (ou prefere
          buscar) escolhe a opção Retirada e marca o dia e a hora no site,
          respeitando o prazo dos doces sob encomenda. Não tem custo.
        </p>
      </Secao>

      <Secao titulo="Doces sob encomenda">
        <p>
          Cada doce mostra no cardápio se é <strong>pronta entrega</strong> ou{" "}
          <strong>sob encomenda</strong>, e nesse caso quantos dias eu preciso
          pra fazer. Se o seu carrinho tiver mais de um doce sob encomenda, vale
          o maior prazo entre eles — porque tudo sai junto.
        </p>
      </Secao>

      <Secao titulo="Formas de pagamento">
        <p>
          O pagamento é pelo Mercado Pago, com <strong>Pix</strong>,{" "}
          <strong>cartão de crédito à vista</strong> ou{" "}
          <strong>cartão de débito</strong>. Não trabalho com boleto nem com
          parcelamento. Os dados do seu cartão são digitados no ambiente do
          Mercado Pago — eu não vejo e não guardo nada disso.
        </p>
        <p>
          O pedido só entra na fila depois que o pagamento é confirmado. Você
          recebe um e-mail a cada mudança: pagamento confirmado, em preparo, a
          caminho e entregue.
        </p>
      </Secao>

      <Secao titulo="Seus dados">
        <p>
          Guardo apenas o necessário pra vender e entregar: nome, e-mail,
          telefone e endereço. Não peço CPF. Sua senha fica guardada de forma
          embaralhada (nem eu consigo ver). Não vendo nem compartilho seus dados
          com ninguém. Se quiser que eu apague seu cadastro, é só pedir.
        </p>
      </Secao>

      <Secao titulo="Avaliações">
        <p>
          Só quem comprou e recebeu o pedido pode avaliar, e a nota é por doce.
          Sua avaliação aparece no cardápio na hora, com o seu primeiro nome.
          Eu não apago avaliação por ser negativa — só escondo mensagem
          ofensiva ou que não tem a ver com o pedido.
        </p>
      </Secao>

      <div className="bg-white/70 border border-cherryLight/30 rounded-cherry p-5 mt-8 text-center font-body">
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
      <div className={`min-w-0 ${ultimo ? "" : "pb-1"}`}>
        <p className="font-display text-base text-cherryDark">{titulo}</p>
        <p className="mt-0.5">{children}</p>
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
