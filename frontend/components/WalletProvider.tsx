"use client";

import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { type ReactNode } from "react";

// Full absolute URL required by @solana/web3.js Connection.
// Browser: window.location.origin gives https://solfactory.pro in prod.
// SSR: fall back to public endpoint (not used for actual calls server-side).
const endpoint =
  typeof window !== "undefined"
    ? window.location.origin + "/api/rpc"
    : "https://api.mainnet-beta.solana.com";

export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={[]} autoConnect={false}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
