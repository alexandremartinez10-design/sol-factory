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
          <footer className="border-t border-zinc-800 py-12 mt-20">
            <div className="mx-auto max-w-7xl px-4 space-y-8">
              {/* Top row: logo + links */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
                {/* Logo + tagline */}
                <div className="flex flex-col items-center sm:items-start gap-1.5">
                  <span className="text-white font-extrabold text-lg tracking-tight">SolFactory</span>
                  <p className="text-zinc-500 text-sm">Launch your NFT collection in 60 seconds</p>
                </div>

                {/* Links */}
                <div className="flex flex-wrap justify-center sm:justify-end gap-x-6 gap-y-2 text-sm text-zinc-500">
                  <a
                    href="https://x.com/solfactory_pro"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-zinc-300 transition-colors"
                  >
                    Twitter / X
                  </a>
                  <a
                    href="https://discord.gg/solfactory"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-zinc-300 transition-colors"
                  >
                    Discord
                  </a>
                  <a href="/terms" className="hover:text-zinc-300 transition-colors">
                    Terms
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

              {/* Bottom row: copyright + built on */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-6 border-t border-zinc-800/60 text-xs text-zinc-600">
                <p>© {new Date().getFullYear()} SolFactory. All rights reserved.</p>
                <p className="flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-purple-500" />
                  Built on Solana
                </p>
              </div>
            </div>
          </footer>
        </WalletProvider>
      </body>
    </html>
  );
}
