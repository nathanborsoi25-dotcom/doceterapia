"use client";

import { useEffect, useRef, useState } from "react";
import { buscarEnderecoPorCep, geocodificarEndereco } from "@/lib/api";
import { formatarCep } from "@/lib/formato";
import { apenasDigitos } from "@/lib/validacoes";
import {
  getEnderecoVisitante,
  salvarEnderecoVisitante,
  type EnderecoVisitante as Endereco,
} from "@/lib/store";

/**
 * Endereço de quem ainda não tem conta, no checkout.
 *
 * Serve só pra mostrar o valor da entrega antes de a pessoa se cadastrar —
 * é a informação que ela quer ANTES de decidir criar conta. Fica guardado no
 * navegador e reaparece já preenchido no cadastro.
 */
export default function EnderecoVisitante({
  onChange,
}: {
  onChange: (endereco: Endereco) => void;
}) {
  const [endereco, setEndereco] = useState<Endereco | null>(null);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [aviso, setAviso] = useState("");
  const numeroRef = useRef<HTMLInputElement>(null);
  /**
   * Cópia sempre atual do endereço. A busca do CEP e a do mapa demoram um
   * pouco, e nesse meio-tempo a pessoa continua digitando — se a resposta
   * fosse aplicada sobre o endereço de quando a busca começou, ela apagaria
   * o número que acabou de ser escrito.
   */
  const atual = useRef<Endereco | null>(null);

  // Lê o que já estava salvo só depois de montar (localStorage não existe no
  // servidor, e ler durante a renderização quebraria a hidratação).
  useEffect(() => {
    const salvo = getEnderecoVisitante();
    atual.current = salvo;
    setEndereco(salvo);
    onChange(salvo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function aplicar(mudancas: Partial<Endereco>) {
    if (!atual.current) return;
    const novo = { ...atual.current, ...mudancas };
    atual.current = novo;
    setEndereco(novo);
    salvarEnderecoVisitante(novo);
    onChange(novo);
  }

  async function mudar(campo: keyof Endereco, valor: string) {
    const tratado = campo === "cep" ? formatarCep(valor) : valor;
    // Mexeu no endereço: as coordenadas antigas não valem mais.
    aplicar({ [campo]: tratado, lat: undefined, lng: undefined });

    if (campo === "cep" && apenasDigitos(tratado).length === 8) {
      await preencherPeloCep(tratado);
    }
  }

  async function preencherPeloCep(cep: string) {
    setBuscandoCep(true);
    setAviso("");
    try {
      const e = await buscarEnderecoPorCep(cep);
      if (!e) {
        setAviso("Não encontramos esse CEP. Você pode preencher à mão.");
        return;
      }
      // Só preenche o que veio do CEP; o resto fica como a pessoa deixou.
      aplicar({
        rua: e.rua || atual.current?.rua,
        bairro: e.bairro || atual.current?.bairro,
        cidade: e.cidade || atual.current?.cidade,
      });
      numeroRef.current?.focus();
    } finally {
      setBuscandoCep(false);
    }
  }

  /**
   * Procura o endereço no mapa sozinho, um instante depois de a pessoa parar
   * de digitar. É a coordenada que dá a distância, e a distância é que define
   * o valor da entrega — por isso não dá pra depender de ela clicar em algum
   * botão "calcular": muita gente preencheria e ficaria olhando pro frete
   * zerado sem entender.
   */
  useEffect(() => {
    if (!endereco?.rua || !endereco?.numero) return;
    if (endereco.lat && endereco.lng) return;

    const timer = setTimeout(async () => {
      const e = atual.current;
      if (!e?.rua || !e?.numero || (e.lat && e.lng)) return;
      const coords = await geocodificarEndereco({
        rua: e.rua,
        numero: e.numero,
        bairro: e.bairro,
        cidade: e.cidade,
        cep: e.cep,
      });
      if (coords.lat != null && coords.lng != null) {
        aplicar({ lat: coords.lat, lng: coords.lng });
      }
    }, 700);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    endereco?.rua,
    endereco?.numero,
    endereco?.bairro,
    endereco?.cidade,
    endereco?.cep,
    endereco?.lat,
  ]);

  if (!endereco) return null;

  return (
    <div className="grid gap-3">
      <Campo
        label="CEP *"
        valor={endereco.cep}
        onChange={(v) => mudar("cep", v)}
        inputMode="numeric"
        placeholder="86700-000"
        dica={buscandoCep ? "Buscando seu endereço..." : "O CEP preenche o resto pra você."}
        erro={aviso || undefined}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 min-w-0">
          <Campo label="Rua *" valor={endereco.rua} onChange={(v) => mudar("rua", v)} />
        </div>
        <div className="min-w-0">
          <Campo
            label="Número *"
            valor={endereco.numero}
            onChange={(v) => mudar("numero", v)}
            inputMode="numeric"
            inputRef={numeroRef}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="min-w-0">
          <Campo label="Bairro" valor={endereco.bairro} onChange={(v) => mudar("bairro", v)} />
        </div>
        <div className="min-w-0">
          <Campo label="Cidade" valor={endereco.cidade} onChange={(v) => mudar("cidade", v)} />
        </div>
      </div>

      <Campo
        label="Complemento"
        valor={endereco.complemento}
        onChange={(v) => mudar("complemento", v)}
        placeholder="Apto, bloco, casa..."
      />
    </div>
  );
}

function Campo({
  label,
  valor,
  onChange,
  placeholder,
  inputMode,
  dica,
  erro,
  inputRef,
}: {
  label: string;
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "numeric" | "text";
  dica?: string;
  erro?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <label className="grid gap-1 text-sm font-body text-ink/80">
      {label}
      <input
        ref={inputRef}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className={`w-full border rounded-xl px-4 py-2.5 bg-white/70 focus:outline-none focus:ring-2 focus:ring-cherryDark ${
          erro ? "border-cherryDark" : "border-cherryLight/60"
        }`}
      />
      {erro ? (
        <span className="text-xs text-cherryDark">{erro}</span>
      ) : dica ? (
        <span className="text-xs text-ink/50">{dica}</span>
      ) : null}
    </label>
  );
}
