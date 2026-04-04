"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export function WalletButton() {
  return (
    <WalletMultiButton
      style={{
        background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
        borderRadius: "0.75rem",
        fontSize: "0.875rem",
        fontWeight: 600,
        height: "2.5rem",
        padding: "0 1.25rem",
      }}
    />
  );
}
