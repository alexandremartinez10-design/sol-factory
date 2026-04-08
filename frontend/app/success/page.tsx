"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Copy, Check, ExternalLink, Loader2, Twitter, Rocket, Link2 } from "lucide-react";
import { NftPreviewCard } from "@/components/NftPreviewCard";
import { truncateAddress } from "@/lib/utils";
import { getConnection } from "@/lib/solana";

function SuccessContent() {
  const searchParams = useSearchParams();
  const name           = searchParams.get("name")           || "Your Collection";
  const address        = searchParams.get("address")        || "";
  const collectionMint = searchParams.get("collectionMint") || "";
  const imageParam     = searchParams.get("image")          || "";
  const symbol     = searchParams.get("symbol")    || "SYM";
  const supply     = Number(searchParams.get("supply")    || 100);
  const mintPrice  = Number(searchParams.get("mintPrice") || 0.05);
  const simulated  = searchParams.get("simulated") === "true";
  const signature  = searchParams.get("signature") || "";

  const [copied, setCopied]             = useState(false);
  const [copiedMintLink, setCopiedMintLink] = useState(false);
  const [confirming, setConfirming]     = useState(!!signature && !simulated);
  const [confirmError, setConfirmError] = useState("");
  const displayImage = imageParam;

  // Poll for on-chain confirmation when a signature is present
  useEffect(() => {
    if (!signature || simulated) return;
    let cancelled = false;
    let attempts  = 0;
    const MAX_ATTEMPTS = 30; // 30 × 2s = 60s max

    async function poll() {
      while (!cancelled && attempts < MAX_ATTEMPTS) {
        try {
          const result = await getConnection().getSignatureStatuses([signature]);
          const status = result?.value?.[0];
          if (status && !status.err && (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized")) {
            if (!cancelled) setConfirming(false);
            return;
          }
          if (status?.err) {
            if (!cancelled) {
              setConfirmError("Transaction failed on-chain. Check the Explorer link.");
              setConfirming(false);
            }
            return;
          }
        } catch { /* network hiccup, keep polling */ }
        attempts++;
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!cancelled) {
        // Timed out — show success anyway, tx may still confirm
        setConfirming(false);
      }
    }

    poll();
    return () => { cancelled = true; };
  }, [signature, simulated]);

  function handleCopy() {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function mintUrl() {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://solfactory.pro";
    if (simulated) return `${origin}/mint/${address}?devnet=true`;
    // Use collectionMint (mpl-core asset) as the URL slug, pass CollectionState PDA as ?pda=
    const url = collectionMint
      ? `${origin}/mint/${collectionMint}?pda=${address}`
      : `${origin}/mint/${address}`;
    console.log("[success] mintUrl params — address (PDA):", address, "collectionMint:", collectionMint, "→", url);
    return url;
  }

  function handleCopyMintLink() {
    if (!address) return;
    navigator.clipboard.writeText(mintUrl());
    setCopiedMintLink(true);
    setTimeout(() => setCopiedMintLink(false), 2000);
  }

  const mintLinkDisplay =
    address
      ? `solfactory.pro/mint/${address.slice(0, 8)}…${address.slice(-4)}${simulated ? "?devnet=true" : ""}`
      : "";

  const explorerUrl = simulated
    ? `https://explorer.solana.com/address/${address}?cluster=devnet`
    : `https://explorer.solana.com/address/${address}`;
  const txExplorerUrl = signature
    ? (simulated ? `https://explorer.solana.com/tx/${signature}?cluster=devnet` : `https://explorer.solana.com/tx/${signature}`)
    : "";
  const pageUrl         = typeof window !== "undefined" ? window.location.href : "";

  // Twitter / X share text differs for simulation vs real launch
  const tweetText = simulated
    ? encodeURIComponent(
        `I just designed my NFT collection "${name}" in 60s on @SolFactory! 🚀 Check the preview: ${pageUrl}`
      )
    : encodeURIComponent(
        `I just launched my NFT collection "${name}" on @SolFactory in 60 seconds! 🔥 No code, just vibes. Check it out: ${explorerUrl}`
      );
  const tweetUrl = `https://twitter.com/intent/tweet?text=${tweetText}`;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      {/* Glow background */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 0%, rgba(124,58,237,0.15) 0%, transparent 70%)",
        }}
      />

      <div className="w-full max-w-lg mx-auto space-y-8 text-center animate-fade-up">
        {/* Celebration */}
        <div className="text-7xl">{simulated ? "✨" : "🎉"}</div>

        {/* On-chain confirmation banner */}
        {confirming && (
          <div className="flex items-center justify-center gap-3 rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-sm text-purple-300">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            Confirming on Solana… this takes a few seconds
          </div>
        )}
        {confirmError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {confirmError}
          </div>
        )}

        {/* Simulation badge */}
        {simulated && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-yellow-500/30 bg-yellow-500/10 text-yellow-300 text-sm font-semibold">
            🧪 Simulated — no SOL was spent
          </div>
        )}

        <div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white">
            {simulated ? "Collection preview ready!" : "Your collection is live!"}
          </h1>
          <p className="mt-3 text-zinc-400 text-lg">
            <span className="text-white font-semibold">{name}</span>{" "}
            {simulated
              ? "looks amazing. Ready to go live on Solana?"
              : "is now on the Solana blockchain."}
          </p>
        </div>

        {/* Address — only shown for real launches */}
        {address && !simulated && (
          <div className="card p-5 space-y-3">
            <p className="text-xs text-zinc-500 font-semibold uppercase tracking-widest">
              Collection address
            </p>
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-sm text-zinc-300 break-all text-left">
                {truncateAddress(address, 8)}
              </span>
              <button
                onClick={handleCopy}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 text-xs font-medium text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
              >
                {copied ? (
                  <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copied</>
                ) : (
                  <><Copy className="w-3.5 h-3.5" /> Copy</>
                )}
              </button>
            </div>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors font-medium"
            >
              View on Explorer
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* Mint link — shown for real launches */}
        {address && !simulated && (
          <div className="card p-5 space-y-3 border-purple-500/20 bg-purple-500/5">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-purple-400 shrink-0" />
              <p className="text-sm font-semibold text-white">Share this link with your community</p>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Anyone with this link can mint an NFT from your collection directly.
            </p>
            <div className="flex items-center gap-2 rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2.5">
              <span className="font-mono text-xs text-zinc-300 flex-1 truncate">
                {mintLinkDisplay}
              </span>
              <button
                onClick={handleCopyMintLink}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white transition-colors"
              >
                {copiedMintLink ? (
                  <><Check className="w-3.5 h-3.5" /> Copied!</>
                ) : (
                  <><Copy className="w-3.5 h-3.5" /> Copy link</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* NFT Preview — shows the user's actual image */}
        <NftPreviewCard
          name={name}
          symbol={symbol}
          supply={supply}
          mintPrice={mintPrice}
          imageUrl={displayImage || undefined}
          className="text-left"
        />

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {/* Go Live — only shown in simulation mode */}
          {simulated && (
            <Link
              href="/create"
              className="btn-primary w-full text-base py-4 justify-center"
            >
              <Rocket className="w-5 h-5" />
              Go Live on Mainnet (0.15 SOL)
            </Link>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={tweetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary flex-1 text-sm py-3.5"
              style={simulated ? { background: "linear-gradient(135deg,#1d9bf0,#1a8cd8)" } : {}}
            >
              <Twitter className="w-4 h-4" />
              {simulated ? "Share preview on X" : "Share on X"}
            </a>
            <Link href="/dashboard" className="btn-ghost flex-1 text-sm py-3.5">
              View my dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
