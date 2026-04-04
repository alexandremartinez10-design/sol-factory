"use client";

import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from "@solana/wallet-adapter-react";
import { type ReactNode, useState, useEffect } from "react";

export function WalletProvider({ children }: { children: ReactNode }) {
  // Start with the public endpoint (matches SSR), switch to the proxy after
  // mount so there's no hydration mismatch on the ConnectionProvider prop.
  const [endpoint, setEndpoint] = useState("https://api.mainnet-beta.solana.com");

  useEffect(() => {
    setEndpoint("/api/rpc");
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={[]} autoConnect={false}>
        {children}
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
