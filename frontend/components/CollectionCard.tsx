"use client";

import { useState } from "react";
import { Copy, Check, ExternalLink, Link2 } from "lucide-react";
import { truncateAddress } from "@/lib/utils";

interface CollectionCardProps {
  name: string;
  symbol: string;
  minted: number;
  supply: number;
  address: string;
  imageUrl?: string;
}

export function CollectionCard({
  name,
  symbol,
  minted,
  supply,
  address,
  imageUrl,
}: CollectionCardProps) {
  const [copied, setCopied]         = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const pct     = Math.min((minted / supply) * 100, 100);
  const soldOut = minted >= supply;

  function handleCopy() {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleCopyMintLink() {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    navigator.clipboard.writeText(`${origin}/mint/${address}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  return (
    <div className="card p-5 space-y-4 hover:border-zinc-700 transition-colors duration-200">
      <div className="flex items-start gap-4">
        {/* Thumbnail */}
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-700 to-purple-600 shrink-0 overflow-hidden">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white font-bold text-lg">
              {symbol.slice(0, 2)}
            </div>
          )}
        </div>

        {/* Name / symbol */}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-white text-base truncate">{name}</h3>
          <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 text-xs font-semibold">
            {symbol}
          </span>
        </div>

        {/* Status badge */}
        {soldOut && (
          <span className="shrink-0 px-2.5 py-1 rounded-full bg-zinc-700 text-zinc-300 text-xs font-semibold">
            Sold out
          </span>
        )}
      </div>

      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-zinc-400 font-medium">
            {minted.toLocaleString()} / {supply.toLocaleString()} minted
          </span>
          <span className="text-zinc-500">{pct.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-600 to-purple-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Address + links */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-zinc-500">
            {truncateAddress(address, 6)}
          </span>
          <button
            onClick={handleCopy}
            className="p-1 rounded text-zinc-500 hover:text-white transition-colors"
            title="Copy address"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyMintLink}
            className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors font-medium"
            title="Copy shareable mint link"
          >
            {copiedLink ? (
              <><Check className="w-3 h-3" /> Copied!</>
            ) : (
              <><Link2 className="w-3 h-3" /> Mint link</>
            )}
          </button>
          <span className="text-zinc-700">·</span>
          <a
            href={`https://explorer.solana.com/address/${address}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors font-medium"
          >
            Explorer
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
