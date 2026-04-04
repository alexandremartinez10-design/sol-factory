"use client";

import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from "@solana/wallet-adapter-react";
import { type ReactNode } from "react";

// Full absolute URL required by @solana/web3.js Connection.
// Browser: use window.location.origin so the proxy URL is always absolute.
// SSR: fall back to public endpoint (wallet adapter doesn't make RPC calls server-side).
const endpoint =
  typeof window !== "undefined"
    ? window.location.origin + "/api/rpc"
    : "https://api.mainnet-beta.solana.com";

export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={[]} autoConnect={false}>
        {children}
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
