"use client";

import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from "@solana/wallet-adapter-react";
import { type ReactNode } from "react";

// Use the RPC URL from env (set to a mainnet endpoint in Vercel env vars).
// Falls back to the public mainnet-beta endpoint.
const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.mainnet-beta.solana.com";

export function WalletProvider({ children }: { children: ReactNode }) {
  // Pass an empty adapters array — modern wallets (Phantom, Solflare, Backpack…)
  // register via the Wallet Standard interface, which @solana/wallet-adapter-react
  // detects automatically through useStandardWalletAdapters. Passing legacy
  // PhantomWalletAdapter / SolflareWalletAdapter is counterproductive here because
  // this version of the package always returns readyState=Unsupported, causing
  // them to be filtered out and the picker to show "No wallets detected."
  return (
    <ConnectionProvider endpoint={RPC_URL}>
      <SolanaWalletProvider wallets={[]} autoConnect={false}>
        {children}
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
