"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useEffect, useState } from "react";

const SITE_URL = "https://solfactory.pro";

function isMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
}

function MobileWalletPrompt() {
  const phantomDeepLink = `https://phantom.app/ul/browse/${encodeURIComponent(SITE_URL)}?ref=${encodeURIComponent(SITE_URL)}`;
  const solflareDeepLink = `https://solflare.com/ul/v1/browse/${encodeURIComponent(SITE_URL)}?ref=${encodeURIComponent(SITE_URL)}`;

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <p className="text-sm text-zinc-400 max-w-xs">
        To connect on mobile, open this site directly in the{" "}
        <span className="text-white font-semibold">Phantom</span> or{" "}
        <span className="text-white font-semibold">Solflare</span> app browser.
      </p>
      <div className="flex flex-col sm:flex-row gap-2 w-full">
        <a
          href={phantomDeepLink}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}
        >
          Open in Phantom
        </a>
        <a
          href={solflareDeepLink}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}
        >
          Open in Solflare
        </a>
      </div>
    </div>
  );
}

export function WalletButton() {
  const { wallets } = useWallet();
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    setMobile(isMobileBrowser());
  }, []);

  // On mobile with no injected wallet, show deep-link prompt instead
  const noWalletDetected = wallets.length === 0;
  if (mobile && noWalletDetected) {
    return <MobileWalletPrompt />;
  }

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
