"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Loader2, Heart, AlertCircle, ExternalLink, Twitter } from "lucide-react";
import { WalletButton } from "@/components/WalletButton";
import { cn } from "@/lib/utils";
import { sendDonation, type AnchorWallet } from "@/lib/solana";

// Discord icon (not in lucide)
function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.04.031.054a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  );
}

const PRESET_AMOUNTS = [0.1, 0.5, 1];
const EXPLORER_BASE  = "https://explorer.solana.com/tx";

export default function DonatePage() {
  const { connected, publicKey, signTransaction, signAllTransactions } = useWallet();

  const [selected, setSelected]     = useState<number>(0.1);
  const [customAmount, setCustomAmount] = useState("");
  const [isSending, setIsSending]   = useState(false);
  const [txSig, setTxSig]           = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);

  const activeAmount = customAmount !== "" ? parseFloat(customAmount) : selected;

  async function handleDonate() {
    if (!connected || !publicKey || !signTransaction || !signAllTransactions) return;
    setIsSending(true);
    setError(null);
    try {
      const wallet: AnchorWallet = { publicKey, signTransaction, signAllTransactions };
      const sig = await sendDonation(wallet, activeAmount);
      setTxSig(sig);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16 space-y-10">

      {/* ── 1. CONTACT SECTION ───────────────────────────────────────────── */}
      <div className="card p-8 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold text-white">Need help?</h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            We&apos;re here to help you launch your collection successfully.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href="https://x.com/solfactory_pro"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2.5 flex-1 px-5 py-3 rounded-xl border border-zinc-600 bg-transparent text-zinc-200 text-sm font-semibold hover:border-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-all duration-150"
          >
            <Twitter className="w-4 h-4 text-sky-400" />
            Contact us on X @solfactory_pro
          </a>
          <a
            href="https://discord.gg/solfactory"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2.5 flex-1 px-5 py-3 rounded-xl border border-zinc-600 bg-transparent text-zinc-200 text-sm font-semibold hover:border-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-all duration-150"
          >
            <DiscordIcon className="w-4 h-4 text-indigo-400" />
            Join our Discord
          </a>
        </div>
      </div>

      {/* ── 2. SUPPORT SECTION ───────────────────────────────────────────── */}
      <div className="px-1 space-y-3">
        <p className="text-sm font-semibold text-zinc-400">Support the project ❤️</p>
        <p className="text-xs text-zinc-500">If SolFactory helped you, consider buying us a coffee.</p>

        {/* Success inline */}
        {txSig ? (
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <span>💜 Thanks! </span>
            <a
              href={`${EXPLORER_BASE}/${txSig}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 underline underline-offset-2 hover:text-emerald-300 transition-colors"
            >
              View tx <ExternalLink className="w-3 h-3" />
            </a>
            <button
              onClick={() => { setTxSig(null); setError(null); }}
              className="ml-2 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              ×
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {/* Preset buttons */}
            {PRESET_AMOUNTS.map((amt) => (
              <button
                key={amt}
                onClick={() => { setSelected(amt); setCustomAmount(""); setError(null); }}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-150",
                  customAmount === "" && selected === amt
                    ? "border-purple-500 bg-purple-500/20 text-white"
                    : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                )}
              >
                ◎ {amt}
              </button>
            ))}

            {/* Custom amount */}
            <input
              type="number"
              min={0.01}
              step={0.01}
              placeholder="Or enter any amount in SOL"
              value={customAmount}
              onChange={(e) => { setCustomAmount(e.target.value); setError(null); }}
              className="flex-1 min-w-[160px] px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500 transition-colors duration-150"
            />

            {/* Send button */}
            {connected ? (
              <button
                onClick={handleDonate}
                disabled={isSending}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150",
                  "bg-purple-600 hover:bg-purple-500 text-white",
                  isSending && "opacity-60 cursor-not-allowed"
                )}
              >
                {isSending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  "Send"
                )}
              </button>
            ) : (
              <WalletButton />
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 text-xs text-red-400">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

    </div>
  );
}
