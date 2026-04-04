"use client";

import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from "@solana/wallet-adapter-react";
import { type ReactNode } from "react";

// During SSR the ConnectionProvider still constructs a Connection object, so
// it needs a valid http(s) URL. Client-side we use /api/rpc to keep the
// Helius key server-side. The SSR value is never used for actual RPC calls.
const ENDPOINT =
  typeof window === "undefined"
    ? "https://api.mainnet-beta.solana.com"
    : "/api/rpc";

export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <ConnectionProvider endpoint={ENDPOINT}>
      <SolanaWalletProvider wallets={[]} autoConnect={false}>
        {children}
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
