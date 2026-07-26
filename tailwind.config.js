/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta extraída da logo DOCETERAPIA
        cream: "#FDF0EA",       // fundo geral
        blush: "#FBDDE0",       // fundo secundário / cards
        cherryDark: "#8C1D2B",  // vermelho cereja escuro (texto "doce")
        cherryLight: "#F0A6B8", // rosa cereja claro (texto "terapia")
        cherryMid: "#C2415A",   // tom intermediário para hover/acentos
        ink: "#3B1A1F",         // texto principal, quase preto avermelhado
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
      },
      borderRadius: {
        cherry: "999px 999px 999px 4px", // leve assimetria orgânica p/ cards
      },
    },
  },
  plugins: [],
};
