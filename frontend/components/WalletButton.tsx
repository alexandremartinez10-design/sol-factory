"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import type { WalletName } from "@solana/wallet-adapter-base";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Copy, LogOut, Check, Wallet } from "lucide-react";
import { truncateAddress } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function WalletButton() {
  const {
    publicKey,
    connected,
    connecting,
    disconnect,
    wallets,
    select,
    connect,
    wallet,
  } = useWallet();

  const [showPicker, setShowPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const pickerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node))
        setShowPicker(false);
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setShowMenu(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // After select() resolves, call connect()
  useEffect(() => {
    if (wallet && !connected && !connecting) {
      connect().catch(() => {});
    }
  }, [wallet]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSelect(name: WalletName) {
    select(name);
    setShowPicker(false);
  }

  function handleCopy() {
    if (!publicKey) return;
    navigator.clipboard.writeText(publicKey.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // ── Connected state ───────────────────────────────────────────────────────
  if (connected && publicKey) {
    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowMenu((v) => !v)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors duration-200",
            "text-sm font-medium text-white",
            "border-emerald-500/60 bg-emerald-500/10 hover:border-emerald-400 hover:bg-emerald-500/15"
          )}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          {truncateAddress(publicKey.toString())}
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 opacity-60 transition-transform duration-200",
              showMenu && "rotate-180"
            )}
          />
        </button>

        {showMenu && (
          <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl z-50 overflow-hidden animate-fade-up">
            <button
              onClick={handleCopy}
              className="flex w-full items-center gap-3 px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              {copied ? "Copied!" : "Copy address"}
            </button>
            <div className="border-t border-zinc-800" />
            <button
              onClick={() => {
                disconnect();
                setShowMenu(false);
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-zinc-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Disconnected state ────────────────────────────────────────────────────
  return (
    <div className="relative" ref={pickerRef}>
      <button
        onClick={() => setShowPicker((v) => !v)}
        disabled={connecting}
        className="btn-primary text-sm px-5 py-2.5"
      >
        <Wallet className="w-4 h-4" />
        {connecting ? "Connecting…" : "Connect Wallet"}
      </button>

      {showPicker && (
        <div className="absolute right-0 top-full mt-2 w-60 rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl z-50 overflow-hidden animate-fade-up">
          <p className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-zinc-500 border-b border-zinc-800">
            Select Wallet
          </p>
          {wallets.length === 0 && (
            <p className="px-4 py-4 text-sm text-zinc-400">
              No wallets detected. Install Phantom or Solflare.
            </p>
          )}
          {wallets.map((w) => (
            <button
              key={w.adapter.name}
              onClick={() => handleSelect(w.adapter.name)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-sm text-white hover:bg-zinc-800 transition-colors"
            >
              {w.adapter.icon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={w.adapter.icon}
                  alt={w.adapter.name}
                  className="w-5 h-5 rounded-md"
                />
              ) : (
                <Wallet className="w-5 h-5 text-zinc-400" />
              )}
              {w.adapter.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
