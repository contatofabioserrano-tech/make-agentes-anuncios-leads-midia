import type { Config } from "tailwindcss";

/**
 * Design system MakeOne (base editorial herdada): preto/branco, papel off-white,
 * uma cor de destaque (accent.*) — troque só aqui quando a paleta oficial da MakeOne chegar.
 * títulos geométricos (Saira), rótulos em mono (JetBrains Mono), corpo Inter.
 * Os nomes antigos (brand.*, surface.*, brand-gradient) foram mantidos e
 * remapeados para o novo visual, para todas as telas mudarem juntas.
 */
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-body)", "Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
        display: ["var(--font-display)", "Arial", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        ink: "#111111",
        paper: "#F2F2EE",
        line: "#DDDDDD",
        // Cor de destaque da marca (provisória até a paleta oficial da MakeOne).
        accent: {
          DEFAULT: "#E11C24",
          dark: "#B71B24",
          soft: "#F6E7E6",
        },
        brand: {
          blue: "#111111",
          violet: "#E11C24",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          muted: "#F2F2EE",
          dark: "#0E0E10",
          "dark-2": "#17171A",
        },
        muted: {
          fg: "#6F6F6A",
        },
      },
      borderRadius: {
        "2xl": "0.875rem",
        "3xl": "1.25rem",
      },
      boxShadow: {
        soft: "0 0 0 1px rgba(17,17,17,0.06)",
        "soft-lg": "0 0 0 1px rgba(17,17,17,0.08), 0 12px 32px rgba(17,17,17,0.08)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(0deg, #111111 0%, #111111 100%)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out",
        shimmer: "shimmer 1.6s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
