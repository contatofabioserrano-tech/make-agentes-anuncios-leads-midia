import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Saira } from "next/font/google";
import "./globals.css";

// Tipografia do portal (fontes livres do Google Fonts).
const display = Saira({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display", display: "swap" });
const body = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "MakeOne — Anúncios, Leads e Mídia",
  description: "Máquina de anúncios, leads e mídia da MakeOne: agentes de IA, marketplaces e landing pages.",
};

export const viewport: Viewport = {
  themeColor: "#111111",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
