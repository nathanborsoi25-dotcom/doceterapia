/*
 * O arquivo que faz o Android deixar INSTALAR o site.
 *
 * O Chrome só oferece "Instalar aplicativo" — e só dispara o
 * `beforeinstallprompt`, que é o botão do nosso convite — quando a página tem
 * um service worker com um tratador de `fetch`. Sem ele, o manifesto e os
 * ícones não bastam: o menu do Chrome oferece no máximo um atalho, que abre
 * com a barra de endereço do navegador em vez de abrir como aplicativo.
 *
 * ⚠️ ELE NÃO GUARDA NADA DE PROPÓSITO.
 *
 * O tratador de `fetch` está aqui vazio: sem `respondWith`, cada pedido segue
 * direto para a rede, como se ele não existisse. É a decisão deliberada de um
 * projeto que já perdeu horas com conteúdo velho servido de cache — preço de
 * doce e recheio que sumiam da tela. Um service worker que guarda páginas
 * traria essa classe de problema de volta, agora dentro do celular da
 * cliente, onde ninguém consegue depurar. Se um dia valer a pena guardar
 * alguma coisa aqui, que seja arquivo estático com nome versionado, nunca
 * HTML nem resposta de API.
 *
 * `skipWaiting` + `clients.claim` fazem uma versão nova assumir na hora, em
 * vez de esperar a pessoa fechar todas as abas — importante justamente porque
 * um service worker enganchado é difícil de tirar do ar depois.
 *
 * Para desligar tudo um dia: troque o corpo deste arquivo por
 * `self.registration.unregister()` dentro do `activate`, e ele se remove
 * sozinho dos aparelhos na visita seguinte.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // De propósito, nada aqui: a existência do tratador é o que o Chrome exige.
});
