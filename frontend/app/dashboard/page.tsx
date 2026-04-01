"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";
import { Plus, Wallet, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { CollectionCard } from "@/components/CollectionCard";
import { WalletButton } from "@/components/WalletButton";
import { getCollections, type CollectionInfo } from "@/lib/solana";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { connected, publicKey } = useWallet();

  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  async function fetchCollections() {
    if (!publicKey) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getCollections(publicKey);
      setCollections(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load collections.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (connected && publicKey) {
      fetchCollections();
    } else {
      setCollections([]);
    }
  }, [connected, publicKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Wallet gate ───────────────────────────────────────────────────────────
  if (!connected || !publicKey) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
          <Wallet className="w-8 h-8 text-zinc-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">Connect your wallet</h2>
          <p className="text-zinc-400 text-sm max-w-xs">
            Connect your wallet to see your collections and track your sales.
          </p>
        </div>
        <WalletButton />
      </div>
    );
  }

  // ── Computed stats ────────────────────────────────────────────────────────
  const totalMinted  = collections.reduce((s, c) => s + c.minted,  0);
  const totalSupply  = collections.reduce((s, c) => s + c.supply,  0);
  const totalRevenue = collections.reduce(
    (s, c) => s + c.mintPrice * Math.max(0, c.minted - 1),
    0
  );

  // ── Connected ─────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-extrabold text-white">My Collections</h1>
          <p className="mt-1 text-zinc-500 text-sm">
            {loading ? (
              "Loading…"
            ) : (
              `${collections.length} collection${collections.length !== 1 ? "s" : ""} on devnet`
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={fetchCollections}
            disabled={loading}
            className="btn-ghost text-sm px-4 py-2.5"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link href="/create" className="btn-primary text-sm px-5 py-2.5">
            <Plus className="w-4 h-4" />
            New collection
          </Link>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        {[
          { label: "Collections",   value: String(collections.length) },
          { label: "Total minted",  value: String(totalMinted)        },
          { label: "Total supply",  value: String(totalSupply)        },
          { label: "Revenue",       value: `◎ ${totalRevenue.toFixed(2)}` },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-zinc-500 mt-1 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-8 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && collections.length === 0 && (
        <div className="flex min-h-[20vh] items-center justify-center gap-3 text-zinc-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          Fetching your collections…
        </div>
      )}

      {/* Empty state */}
      {!loading && collections.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center gap-5 py-20 text-center">
          <p className="text-zinc-400">You haven&apos;t launched any collections yet.</p>
          <Link href="/create?devnet=true" className="btn-primary text-sm px-6 py-3">
            Launch your first collection
          </Link>
        </div>
      )}

      {/* Collection list */}
      {collections.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {collections.map((c) => (
            <CollectionCard
              key={c.address}
              name={c.name}
              symbol={c.symbol}
              minted={c.minted}
              supply={c.supply}
              address={c.address}
              imageUrl={`https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=7c3aed&color=fff&size=256`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
