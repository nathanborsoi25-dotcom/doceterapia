/**
 * Desenha os ícones da tela de início e grava em `public/`.
 *
 *   npx tsx scripts/gerar-icones.ts
 *
 * Roda na mão, quando a arte mudar — o resultado é versionado. A primeira
 * tentativa gerava os ícones em tempo de execução com `next/og`, mas o
 * @vercel/og quebra o `next build` no Windows ("Invalid URL" no
 * `fileURLToPath`), e ícone é coisa que não pode derrubar deploy.
 *
 * O PNG é escrito byte a byte com `zlib`, que já vem no Node: uma cereja não
 * justifica trazer uma biblioteca de imagem pro projeto.
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

type Cor = [number, number, number];

const CHERRY_DARK: Cor = [140, 29, 43]; // #8C1D2B
const CHERRY_MID: Cor = [194, 65, 90]; // #C2415A
const CREAM: Cor = [253, 240, 234]; // #FDF0EA

/** Quantas amostras por pixel. 4×4 é o que tira o serrilhado da curva. */
const AMOSTRAS = 4;

function dentroDoCirculo(x: number, y: number, cx: number, cy: number, r: number) {
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

/** Distância de um ponto até o segmento de reta — é assim que o cabinho ganha grossura. */
function dentroDaLinha(
  x: number,
  y: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  grossura: number
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const comprimento = dx * dx + dy * dy;
  let t = comprimento === 0 ? 0 : ((x - x1) * dx + (y - y1) * dy) / comprimento;
  t = Math.max(0, Math.min(1, t));
  const px = x1 + t * dx;
  const py = y1 + t * dy;
  return (x - px) ** 2 + (y - py) ** 2 <= (grossura / 2) ** 2;
}

/**
 * A cor de um ponto do desenho, em coordenadas de 0 a 1.
 *
 * ⚠️ Quem é testado PRIMEIRO fica por cima. As frutas vêm antes dos cabinhos
 * de propósito: na primeira versão os cabos eram testados antes e apareciam
 * atravessados sobre a cereja escura, como um risco rosa no meio da fruta.
 * Cabo tem que sair de TRÁS.
 */
function corDoPonto(u: number, v: number): Cor {
  // As duas cerejas, por cima de tudo.
  if (dentroDoCirculo(u, v, 0.405, 0.635, 0.12)) return CHERRY_DARK;
  if (dentroDoCirculo(u, v, 0.615, 0.63, 0.12)) return CHERRY_MID;

  // Cabinhos, saindo de um ponto só lá em cima e sumindo atrás das frutas.
  if (
    dentroDaLinha(u, v, 0.405, 0.62, 0.55, 0.3, 0.03) ||
    dentroDaLinha(u, v, 0.615, 0.62, 0.55, 0.3, 0.03)
  ) {
    return CHERRY_MID;
  }

  // O prato creme, que é o que dá contraste contra qualquer papel de parede.
  if (dentroDoCirculo(u, v, 0.5, 0.5, 0.38)) return CREAM;
  return CHERRY_DARK;
}

function desenhar(lado: number): Buffer {
  // Uma linha de PNG começa com o byte do filtro (0 = nenhum).
  const linha = lado * 4 + 1;
  const bruto = Buffer.alloc(linha * lado);

  for (let y = 0; y < lado; y++) {
    bruto[y * linha] = 0;
    for (let x = 0; x < lado; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < AMOSTRAS; sy++) {
        for (let sx = 0; sx < AMOSTRAS; sx++) {
          const u = (x + (sx + 0.5) / AMOSTRAS) / lado;
          const v = (y + (sy + 0.5) / AMOSTRAS) / lado;
          const c = corDoPonto(u, v);
          r += c[0];
          g += c[1];
          b += c[2];
        }
      }
      const total = AMOSTRAS * AMOSTRAS;
      const i = y * linha + 1 + x * 4;
      bruto[i] = Math.round(r / total);
      bruto[i + 1] = Math.round(g / total);
      bruto[i + 2] = Math.round(b / total);
      bruto[i + 3] = 255; // opaco: ícone com buraco fica feio em fundo claro
    }
  }
  return bruto;
}

// ---------- Escrita do PNG ----------

const TABELA_CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = -1;
  for (const byte of buf) c = TABELA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function bloco(tipo: string, dados: Buffer): Buffer {
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, "ascii"), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([tamanho, corpo, crc]);
}

function png(lado: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lado, 0);
  ihdr.writeUInt32BE(lado, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // compressão padrão
  ihdr[11] = 0; // filtro padrão
  ihdr[12] = 0; // sem entrelaçamento

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco("IHDR", ihdr),
    bloco("IDAT", deflateSync(desenhar(lado), { level: 9 })),
    bloco("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public", { recursive: true });
for (const lado of [180, 192, 512]) {
  const arquivo = `public/icone-${lado}.png`;
  const dados = png(lado);
  writeFileSync(arquivo, dados);
  console.log(`${arquivo} — ${lado}×${lado}, ${(dados.length / 1024).toFixed(1)} kB`);
}
console.log("Pronto. 🍒");
