/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Newsreader"', "Georgia", "serif"],
        sans: ['"Public Sans"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "monospace"],
      },
      colors: {
        // New exact palette for the Login + Dashboard redesign
        navy: {
          950: "#0b0f16", 900: "#0d1218", 800: "#0e131b",
          700: "#12181f", 600: "#141b26", 500: "#1a2230",
        },
        cream: { DEFAULT: "#faf7f1", soft: "#f6f3ec", card: "#fdfcf9" },
        ink: "#1c1a17",
        gold: { DEFAULT: "#b8934c", light: "#d4b876", pale: "#e8cd93", paler: "#f0d9a8" },
        burgundy: { DEFAULT: "#7a3340", dark: "#602531", deep: "#241019" },

        // Older palette, still used elsewhere in the app
        paper: { DEFAULT: "#FAF6EC", dim: "#F1EADA" },
        inkscale: {
          50: "#F1F1EF", 100: "#DFDFDB", 200: "#B8BCC4", 300: "#8B92A1",
          400: "#5F6B80", 500: "#3E4C63", 600: "#2C3A52", 700: "#1F2B40",
          800: "#161F30", 900: "#0F1622",
        },
        seal: {
          50: "#FBECEA", 100: "#F3CBC5", 300: "#D07267", 500: "#A6332B",
          600: "#8E2A23", 700: "#6E211B",
        },
        brass: {
          50: "#FAF3E2", 100: "#F0DEAF", 300: "#D2AC55", 500: "#A9832F",
          600: "#8C6C26",
        },
      },
    },
  },
  plugins: [],
}
