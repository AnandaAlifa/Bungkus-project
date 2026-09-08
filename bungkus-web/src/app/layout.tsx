import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Bungkus! — Selamatkan Makanan, Selamatkan Bumi",
  description:
    "Platform clearance makanan near-expiry terbesar di Indonesia. Hemat hingga 70% & kurangi food waste.",
  keywords: ["food waste", "clearance", "near-expiry", "Indonesia", "sustainability"],
  openGraph: {
    title: "Bungkus! — Selamatkan Makanan, Selamatkan Bumi",
    description: "Hemat hingga 70% untuk makanan segar berkualitas.",
    url: "https://bungkus.id",
    siteName: "Bungkus!",
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bungkus!",
    description: "Hemat hingga 70% untuk makanan segar berkualitas.",
  },
  manifest: "/manifest.json",
  themeColor: "#0E9F6E",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className={inter.className}>
        <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-dark-100">
          <div className="section-container flex items-center justify-between h-16">
            <a href="/" className="text-2xl font-bold text-eco-500">
              🌱 Bungkus!
            </a>
            <div className="hidden md:flex items-center gap-8">
              <a href="#impact" className="text-dark-600 hover:text-eco-500 transition">
                Dampak
              </a>
              <a href="#how-it-works" className="text-dark-600 hover:text-eco-500 transition">
                Cara Kerja
              </a>
              <a href="/merchant" className="text-dark-600 hover:text-eco-500 transition">
                Merchant
              </a>
            </div>
            <div className="flex items-center gap-3">
              <a href="/app" className="btn-primary text-sm">
                Buka App
              </a>
            </div>
          </div>
        </nav>
        <main>{children}</main>
        <footer className="bg-dark-900 text-white py-12">
          <div className="section-container text-center">
            <p className="text-dark-400">
              © 2026 Bungkus! — Selamatkan Makanan, Selamatkan Bumi 🌍
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
