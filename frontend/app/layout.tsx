import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import { WalletProvider } from "@/components/WalletProvider";
import { NavBar } from "@/components/NavBar";
import { SimBanner } from "@/components/SimBanner";
import { Polyfills } from "@/components/Polyfills";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://solfactory.pro"),
  title: "SolFactory — Launch your NFT collection in 60 seconds",
  description:
    "No code. No setup. Just connect your wallet and go live instantly on Solana.",
  alternates: {
    canonical: "https://solfactory.pro",
  },
  openGraph: {
    title: "SolFactory",
    description: "Launch your NFT collection in 60 seconds on Solana.",
    url: "https://solfactory.pro",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-[#0a0a0a] text-white antialiased`}>
        <WalletProvider>
          <Polyfills />
          <NavBar />
          <main className="min-h-screen pt-16">
            <Suspense fallback={null}><SimBanner /></Suspense>
            {children}
          </main>
          <footer className="border-t border-zinc-800 py-8 mt-20">
            <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-500">
              <p>
                © {new Date().getFullYear()}{" "}
                <span className="text-zinc-400 font-semibold">SolFactory</span> · Built on
                Solana
              </p>
              <div className="flex gap-6">
                <a href="/donate" className="hover:text-zinc-300 transition-colors">
                  Support
                </a>
                <a
                  href="https://explorer.solana.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-zinc-300 transition-colors"
                >
                  Explorer
                </a>
              </div>
            </div>
          </footer>
        </WalletProvider>
      </body>
    </html>
  );
}
