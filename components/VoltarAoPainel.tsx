import Link from "next/link";

/**
 * Volta para o painel, no mesmo lugar em toda tela da Camily.
 *
 * Ela usa o site pelo celular, onde o "voltar" do navegador é um gesto que
 * nem todo mundo lembra — e sem esta saída dava pra ficar preso numa tela
 * interna sem perceber que o resto do painel continua ali.
 */
export default function VoltarAoPainel() {
  return (
    <Link
      href="/admin"
      className="shrink-0 text-sm text-cherryDark underline font-body py-3 px-1"
    >
      Voltar ao painel
    </Link>
  );
}
