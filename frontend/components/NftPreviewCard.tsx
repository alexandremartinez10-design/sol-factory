"use client";

import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface NftPreviewCardProps {
  name?: string;
  symbol?: string;
  supply?: number;
  mintPrice?: number;
  imageUrl?: string;
  /** If true, animate border when any value changes */
  animated?: boolean;
  className?: string;
}

export function NftPreviewCard({
  name,
  symbol,
  supply,
  mintPrice,
  imageUrl,
  animated = false,
  className,
}: NftPreviewCardProps) {
  const displayName = name || "Your Collection Name";
  const displaySymbol = symbol || "SYM";
  const displaySupply = supply ?? 100;
  const displayPrice = mintPrice ?? 0.05;

  return (
    <div
      className={cn(
        "card overflow-hidden w-full max-w-sm mx-auto transition-all duration-300",
        animated && "ring-1 ring-purple-500/30 glow-purple",
        className
      )}
    >
      {/* Image area */}
      <div className="relative aspect-square w-full bg-zinc-800 overflow-hidden">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={displayName}
            className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-violet-900/30 to-purple-900/20">
            <div className="w-16 h-16 rounded-2xl bg-zinc-700/60 flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-zinc-500" />
            </div>
            <p className="text-xs text-zinc-500 font-medium">Upload an image</p>
          </div>
        )}

        {/* Edition badge */}
        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm text-xs font-semibold text-zinc-300">
          #{displaySymbol}
        </div>
      </div>

      {/* Info area */}
      <div className="p-4 space-y-3">
        {/* Name row */}
        <div>
          <h3 className="font-bold text-white text-lg leading-tight truncate">
            {displayName}
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5 font-medium uppercase tracking-wider">
            {displaySymbol} · {displaySupply.toLocaleString()} total
          </p>
        </div>

        {/* Divider */}
        <div className="border-t border-zinc-700/50" />

        {/* Price row */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500 font-medium">Mint price</span>
          <span className="text-sm font-bold text-white">
            ◎ {displayPrice.toFixed(2)} SOL
          </span>
        </div>

        {/* Mint button preview */}
        <button
          className="btn-primary w-full text-sm py-2.5 cursor-default pointer-events-none"
          tabIndex={-1}
        >
          Mint Now
        </button>
      </div>

      {/* Label */}
      <div className="px-4 pb-3">
        <p className="text-center text-[11px] text-zinc-600">
          NFT Preview — This is exactly what your buyers will see
        </p>
      </div>
    </div>
  );
}
