import Link from "next/link";
import CherryDivider from "@/components/CherryDivider";
import { TELEFONE_EXIBICAO, linkWhatsApp } from "@/lib/contato";

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
export default function PoliticaPage() {
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
        ficar qualquer dúvida, me chame no WhatsApp {TELEFONE_EXIBICAO} — eu
        respondo pessoalmente.
      </p>
      <CherryDivider />

      <Secao titulo="Cancelamento do pedido">
        <p>
          Você pode cancelar o pedido sozinha, aqui pelo site, em{" "}
          <Link href="/conta" className="text-cherryDark underline">
            Minha conta
          </Link>
          , enquanto ele estiver como <strong>&ldquo;Aguardando
          pagamento&rdquo;</strong> ou <strong>&ldquo;Pagamento
          confirmado&rdquo;</strong>.
        </p>
        <p>
          A partir de <strong>&ldquo;Em preparo&rdquo;</strong> o cancelamento
          passa por mim: os ingredientes já foram usados e os doces já estão
          sendo feitos. Me chame no WhatsApp que a gente resolve junto — nunca
          deixei ninguém na mão até hoje.
        </p>
        <p>
          Doces são alimentos perecíveis e feitos sob medida, então não há
          troca ou devolução depois da entrega. Se algo chegar diferente do
          combinado, me mande uma foto no mesmo dia que eu resolvo.
        </p>
      </Secao>

      <Secao titulo="Devolução do dinheiro">
        <p>
          Quando um pedido pago é cancelado, o estorno é pedido ao Mercado Pago
          na mesma hora, pelo valor total (doces + entrega, menos o desconto que
          tiver sido usado).
        </p>
        <ul className="list-disc pl-5 grid gap-1">
          <li>
            <strong>Pix:</strong> o valor costuma voltar para a sua conta em
            minutos, e no máximo em alguns dias úteis.
          </li>
          <li>
            <strong>Cartão de crédito:</strong> o estorno aparece na fatura —
            dependendo da data de fechamento, pode ser só na fatura seguinte.
            Quem define esse prazo é o banco, não a loja.
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

      <Secao titulo="Prazo de arrependimento (compras online)">
        <p>
          O Código de Defesa do Consumidor dá 7 dias para desistir de uma compra
          feita fora da loja física (art. 49). Esse direito vale aqui — mas, por
          se tratar de <strong>alimento perecível e feito sob encomenda</strong>,
          ele precisa ser exercido <strong>antes de eu começar a preparar</strong>,
          que é exatamente a regra de cancelamento explicada acima.
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
          Guardo apenas o necessário pra vender e entregar: nome, CPF, e-mail,
          telefone e endereço. Sua senha fica guardada de forma embaralhada
          (nem eu consigo ver). Não vendo nem compartilho seus dados com
          ninguém. Se quiser que eu apague seu cadastro, é só pedir.
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
