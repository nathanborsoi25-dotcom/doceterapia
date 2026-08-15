/**
 * Desenha a imagem de prévia do link (`public/og.jpg`, 1200×630) — a figura
 * que aparece quando alguém manda doceterapia.net.br no WhatsApp.
 *
 * Por que um servidor local em vez de gerar direto pelo Node: o desenho usa a
 * Fraunces e a Nunito, as fontes do site, e quem sabe desenhar texto com fonte
 * de verdade é o navegador. `next/og` seria o caminho natural, mas ele quebra
 * o build no Windows (`Invalid URL` no fileURLToPath), e imagem de divulgação
 * não pode derrubar deploy.
 *
 * A foto e a logo são servidas por AQUI de propósito: imagem de outro domínio
 * "suja" o canvas e o navegador passa a recusar `toDataURL`. Servindo tudo na
 * mesma origem, o desenho volta inteiro.
 *
 * Como rodar:  node scripts/gerar-og.mjs
 * Depois abra http://localhost:4599 no navegador — ele desenha, envia e o
 * script grava o arquivo e se encerra sozinho.
 */
import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORTA = 4599;
const SAIDA = join(RAIZ, "public", "og.jpg");

/** Doce em destaque na prévia. Troque a URL aqui quando mudar a vitrine. */
const FOTO_DO_DOCE =
  "https://y9um9kadn6mqu4qr.public.blob.vercel-storage.com/produtos/foto-afK5Ul2noM2aed6jo0TfzYHz2ITcA4.png";

const PAGINA = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Gerando a imagem de prévia…</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Nunito:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  body { background:#FDF0EA; font-family:Nunito, sans-serif; color:#3B1A1F; display:flex;
         flex-direction:column; align-items:center; gap:16px; padding:24px; }
  canvas { max-width:100%; border:1px solid rgba(240,166,184,.5); border-radius:12px; }
</style>
</head>
<body>
<p id="aviso">Desenhando…</p>
<canvas id="tela" width="1200" height="630"></canvas>
<script>
const CREAM='#FDF0EA', CHERRY_DARK='#8C1D2B', CHERRY_LIGHT='#F0A6B8';
const carrega = src => new Promise((ok, err) => {
  const i = new Image(); i.onload = () => ok(i); i.onerror = err; i.src = src;
});

(async () => {
  const c = document.getElementById('tela'), x = c.getContext('2d');
  const W = c.width, H = c.height;
  const [foto, logo] = await Promise.all([carrega('/foto'), carrega('/logo')]);
  // Cada corpo e peso precisa ser pedido explicitamente: sem isso o canvas
  // desenha com a fonte de sistema e ninguém avisa. Já saiu Arial no lugar da
  // Nunito uma vez — e só apareceu quando a imagem foi aberta e olhada.
  await Promise.all([
    document.fonts.load('700 84px Fraunces'),
    document.fonts.load('600 34px Nunito'),
    document.fonts.load('400 29px Nunito'),
    document.fonts.load('700 30px Nunito'),
  ]);
  await document.fonts.ready;

  x.fillStyle = CREAM; x.fillRect(0, 0, W, H);

  // Cartão da foto: arco alto no topo, a assinatura visual do cardápio.
  const cx = 650, cy = 52, cw = 490, ch = 526, r = cw / 2;
  const arco = () => {
    x.beginPath();
    x.moveTo(cx, cy + r);
    x.arc(cx + r, cy + r, r, Math.PI, 0);
    x.lineTo(cx + cw, cy + ch - 40);
    x.quadraticCurveTo(cx + cw, cy + ch, cx + cw - 40, cy + ch);
    x.lineTo(cx + 14, cy + ch);
    x.quadraticCurveTo(cx, cy + ch, cx, cy + ch - 14);
    x.closePath();
  };

  x.save();
  x.shadowColor = 'rgba(140,29,43,0.18)'; x.shadowBlur = 34; x.shadowOffsetY = 10;
  arco(); x.fillStyle = '#fff'; x.fill();
  x.restore();

  x.save(); arco(); x.clip();
  const e = Math.max(cw / foto.width, ch / foto.height);
  const fw = foto.width * e, fh = foto.height * e;
  x.drawImage(foto, cx + (cw - fw) / 2, cy + (ch - fh) / 2, fw, fh);
  x.restore();
  arco(); x.strokeStyle = 'rgba(240,166,184,0.55)'; x.lineWidth = 3; x.stroke();

  // A logo é um PNG quadrado com fundo próprio: sem o recorte redondo ela vira
  // um bloco de cor visível por cima do creme da página.
  const lx = 88, ly = 100, ld = 112;
  x.save();
  x.beginPath(); x.arc(lx + ld / 2, ly + ld / 2, ld / 2, 0, Math.PI * 2); x.clip();
  x.drawImage(logo, lx, ly, ld, ld);
  x.restore();

  x.fillStyle = CHERRY_DARK; x.font = '700 84px Fraunces';
  x.fillText('Doceterapia', 84, 310);
  x.strokeStyle = CHERRY_LIGHT; x.lineWidth = 4; x.lineCap = 'round';
  x.beginPath(); x.moveTo(88, 352); x.lineTo(300, 352); x.stroke();

  /** Encolhe a linha até caber na coluna, pra nunca encostar na foto. */
  const linha = (texto, corpo, peso, cor, y, limite = 520) => {
    let t = corpo;
    do { x.font = peso + ' ' + t + 'px Nunito'; t -= 1; } while (x.measureText(texto).width > limite && t > 14);
    x.fillStyle = cor;
    x.fillText(texto, 84, y);
  };
  linha('Doces artesanais em Arapongas-PR', 34, 600, 'rgba(59,26,31,0.78)', 416);
  linha('Peça pelo site — entrega ou retirada', 29, 400, 'rgba(59,26,31,0.55)', 464);
  linha('doceterapia.net.br', 30, 700, CHERRY_DARK, 534);

  const dados = c.toDataURL('image/jpeg', 0.86);
  await fetch('/salvar', { method: 'POST', body: dados });
  document.getElementById('aviso').textContent = 'Prontinho, imagem gravada em public/og.jpg 🍒';
})().catch(err => { document.getElementById('aviso').textContent = 'Falhou: ' + err; });
</script>
</body>
</html>`;

const servidor = createServer(async (req, res) => {
  if (req.url === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(PAGINA);
  }
  if (req.url === "/foto") {
    const r = await fetch(FOTO_DO_DOCE);
    const buf = Buffer.from(await r.arrayBuffer());
    res.writeHead(200, { "content-type": r.headers.get("content-type") ?? "image/png" });
    return res.end(buf);
  }
  if (req.url === "/logo") {
    res.writeHead(200, { "content-type": "image/png" });
    return res.end(readFileSync(join(RAIZ, "public", "logo.png")));
  }
  if (req.url === "/salvar" && req.method === "POST") {
    let corpo = "";
    req.on("data", (p) => (corpo += p));
    req.on("end", () => {
      const base64 = corpo.replace(/^data:image\/jpeg;base64,/, "");
      writeFileSync(SAIDA, Buffer.from(base64, "base64"));
      const kb = Math.round(Buffer.from(base64, "base64").length / 1024);
      console.log(`✅ public/og.jpg gravado (${kb} KB, 1200×630)`);
      res.writeHead(200); res.end("ok");
      setTimeout(() => servidor.close(() => process.exit(0)), 300);
    });
    return;
  }
  res.writeHead(404); res.end();
});

servidor.listen(PORTA, () => {
  console.log(`Abra http://localhost:${PORTA} no navegador para desenhar a imagem.`);
});
