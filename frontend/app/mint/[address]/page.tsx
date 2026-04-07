"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams }                  from "next/navigation";
import { useWallet }                                   from "@solana/wallet-adapter-react";
import { Transaction }                                 from "@solana/web3.js";
import Link                                            from "next/link";
import {
  Loader2, ExternalLink, Twitter, AlertCircle,
  CheckCircle2, Wallet, Sparkles, ImageOff,
} from "lucide-react";

import { WalletButton }                        from "@/components/WalletButton";
import { getCollectionByAddress, getConnection } from "@/lib/solana";
import type { CollectionInfo }                 from "@/lib/solana";
import { cn }                                  from "@/lib/utils";

// ── Base58 alphabet for fake tx IDs ──────────────────────────────────────────
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function fakeB58(len: number) {
  return Array.from({ length: len }, () => B58[Math.floor(Math.random() * B58.length)]).join("");
}

// ── Supply bar ────────────────────────────────────────────────────────────────
function SupplyBar({ minted, supply }: { minted: number; supply: number }) {
  const mintedCount = Math.max(0, minted - 1);
  const pct = Math.min(100, Math.round((mintedCount / supply) * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-zinc-400">
        <span>{mintedCount} minted</span>
        <span>{supply} total</span>
      </div>
      <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-zinc-500 text-right">{supply - mintedCount} remaining</p>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
type MintState = "idle" | "preparing" | "signing" | "confirming" | "done" | "error";

// ── Inner component (uses useSearchParams — wrapped in Suspense below) ────────
function MintContent({ address }: { address: string }) {
  const searchParams = useSearchParams();
  const isDevnetParam = searchParams?.get("devnet") === "true";

  const { publicKey, connected, signTransaction } = useWallet();

  const [collection, setCollection]     = useState<CollectionInfo | null>(null);
  const [loadingInfo, setLoadingInfo]   = useState(!isDevnetParam);
  const [simMode, setSimMode]           = useState(isDevnetParam);

  const [mintState, setMintState]       = useState<MintState>("idle");
  const [mintError, setMintError]       = useState<string>("");
  const [txSig, setTxSig]               = useState<string>("");
  const [mintedNft, setMintedNft]       = useState<string>("");
  const [simMint, setSimMint]           = useState(false);

  // ── Mock collection for sim mode ─────────────────────────────────────────
  const mockCollection: CollectionInfo = {
    address,
    name:              "Demo Collection",
    symbol:            "DEMO",
    supply:            100,
    mintPrice:         0.05,
    minted:            8,
    collectionMint:    address,
    publicMintEnabled: true,
  };

  // ── Load collection from chain ────────────────────────────────────────────
  const loadCollection = useCallback(async () => {
    if (isDevnetParam) {
      // Devnet sim mode: skip RPC, use mock
      setCollection(mockCollection);
      setSimMode(true);
      return;
    }
    setLoadingInfo(true);
    try {
      const info = await getCollectionByAddress(address);
      if (!info) {
        // Not on-chain → fall back to sim mode gracefully
        setCollection(mockCollection);
        setSimMode(true);
      } else {
        // If imageUrl wasn't resolved by getCollectionByAddress, call getAsset directly
        if (!info.imageUrl && info.collectionMint) {
          try {
            const assetRes = await fetch("/api/rpc", {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body:    JSON.stringify({
                jsonrpc: "2.0",
                id:      "1",
                method:  "getAsset",
                params:  { id: info.collectionMint },
              }),
            });
            const assetData = await assetRes.json() as {
              result?: { content?: { links?: { image?: string }; files?: { uri?: string }[]; json_uri?: string } };
            };
            console.log("[mint page] getAsset content:", assetData.result?.content);
            info.imageUrl =
              assetData.result?.content?.links?.image ||
              assetData.result?.content?.files?.[0]?.uri ||
              undefined;
          } catch (e) {
            console.warn("[mint page] getAsset failed:", e);
          }
        }
        setCollection(info);
        setSimMode(false);
      }
    } catch {
      setCollection(mockCollection);
      setSimMode(true);
    } finally {
      setLoadingInfo(false);
    }
  }, [address, isDevnetParam]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadCollection(); }, [loadCollection]);

  // ── Simulated mint (2 s fake loading) ─────────────────────────────────────
  async function handleSimMint() {
    setSimMint(true);
    setMintState("preparing");
    await new Promise((r) => setTimeout(r, 1000));
    setMintState("confirming");
    await new Promise((r) => setTimeout(r, 1000));
    setTxSig(fakeB58(88));
    setMintedNft(fakeB58(44));
    setMintState("done");
  }

  // ── Real mint ─────────────────────────────────────────────────────────────
  async function handleMint() {
    if (!collection) return;

    if (simMode) {
      await handleSimMint();
      return;
    }

    if (!publicKey || !signTransaction) return;
    setMintState("preparing");
    setMintError("");

    try {
      const res = await fetch("/api/mint", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          collectionStatePda: address,
          buyerPubkey:        publicKey.toString(),
        }),
      });

      const data = await res.json() as {
        transaction?: string;
        nftMint?: string;
        lastValidBlockHeight?: number;
        blockhash?: string;
        error?: string;
      };

      if (!res.ok) throw new Error(data.error || "Server error");
      if (!data.transaction) throw new Error("No transaction returned");

      const tx = Transaction.from(Buffer.from(data.transaction, "base64"));

      setMintState("signing");
      const signedTx = await signTransaction(tx);

      setMintState("confirming");
      const sig = await getConnection().sendRawTransaction(signedTx.serialize());
      await getConnection().confirmTransaction(
        { signature: sig, blockhash: data.blockhash!, lastValidBlockHeight: data.lastValidBlockHeight! },
        "confirmed"
      );

      setTxSig(sig);
      setMintedNft(data.nftMint ?? "");
      setMintState("done");
      loadCollection();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (msg.toLowerCase().includes("user rejected") || msg.toLowerCase().includes("cancelled")) {
        setMintState("idle");
      } else {
        setMintError(msg);
        setMintState("error");
      }
    }
  }

  // ── Button label ──────────────────────────────────────────────────────────
  function mintButtonLabel() {
    switch (mintState) {
      case "preparing":  return <><Loader2 className="w-4 h-4 animate-spin" /> Preparing…</>;
      case "signing":    return <><Loader2 className="w-4 h-4 animate-spin" /> Waiting for signature…</>;
      case "confirming": return <><Loader2 className="w-4 h-4 animate-spin" /> Confirming on-chain…</>;
      default:
        return <><Sparkles className="w-4 h-4" /> Mint this NFT ({collection?.mintPrice ?? "?"} SOL)</>;
    }
  }

  const isMinting     = ["preparing", "signing", "confirming"].includes(mintState);
  const isFullyMinted = collection ? (collection.minted - 1) >= collection.supply : false;
  const explorerUrl   = txSig && !simMint
    ? `https://explorer.solana.com/tx/${txSig}?cluster=devnet`
    : "";

  const avatarUrl = collection
    ? `https://ui-avatars.com/api/?name=${encodeURIComponent(collection.name)}&background=7c3aed&color=fff&size=400&bold=true&format=svg`
    : "";

  // ── Loading spinner ───────────────────────────────────────────────────────
  if (loadingInfo) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 py-16">
      {/* Background glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 0%, rgba(124,58,237,0.15) 0%, transparent 70%)",
        }}
      />

      <div className="w-full max-w-md mx-auto space-y-6 animate-fade-up">

        {/* Header */}
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-purple-400 mb-2">
            NFT Mint{simMode ? " · Simulation" : ""}
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
            {collection?.name}
          </h1>
          <p className="text-zinc-400 text-sm mt-1 font-mono">{collection?.symbol}</p>
        </div>

        {/* Collection image */}
        <div className="card p-4 flex justify-center">
          <div className="relative w-56 h-56 rounded-xl overflow-hidden border border-zinc-700">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={collection?.imageUrl || avatarUrl}
              alt={collection?.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
                (e.currentTarget.nextElementSibling as HTMLElement | null)
                  ?.classList.remove("hidden");
              }}
            />
            <div className="hidden absolute inset-0 flex items-center justify-center bg-zinc-800">
              <ImageOff className="w-10 h-10 text-zinc-600" />
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="card p-5 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-zinc-400">Mint price</span>
            <span className="text-lg font-bold text-white">{collection?.mintPrice} SOL</span>
          </div>
          {collection && <SupplyBar minted={collection.minted} supply={collection.supply} />}
        </div>

        {/* Success state */}
        {mintState === "done" && (
          <div className="card p-5 border-emerald-500/30 bg-emerald-500/5 space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
              <CheckCircle2 className="w-5 h-5" />
              NFT minted! Check your wallet 🎉
            </div>
            {simMint && (
              <p className="text-xs text-yellow-400/80">🧪 Simulated — no real transaction</p>
            )}
            {explorerUrl && (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-purple-400 hover:text-purple-300 transition-colors font-medium"
              >
                View transaction <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                `I just minted an NFT from "${collection?.name}" on @SolFactory! 🚀`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary w-full text-sm py-2.5 justify-center"
            >
              <Twitter className="w-4 h-4" />
              Share on X
            </a>
          </div>
        )}

        {/* Error state */}
        {mintState === "error" && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>Mint failed, please try again.</p>
            </div>
            <button
              onClick={() => setMintState("idle")}
              className="mt-3 text-xs text-zinc-400 hover:text-white underline underline-offset-2 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {/* Mint action area */}
        {mintState !== "done" && (
          <div className="space-y-3">
            {isFullyMinted ? (
              <div className="card p-6 flex flex-col items-center gap-3 text-center">
                <div className="text-4xl">🔒</div>
                <p className="text-xl font-bold text-white">Sold out</p>
                <p className="text-sm text-zinc-400">
                  All {collection?.supply} NFTs from this collection have been minted.
                </p>
              </div>
            ) : !connected && !simMode ? (
              <div className="card p-5 flex flex-col items-center gap-3 text-center">
                <Wallet className="w-8 h-8 text-zinc-500" />
                <p className="text-sm text-zinc-400">Connect your wallet to mint</p>
                <WalletButton />
              </div>
            ) : (
              <button
                onClick={handleMint}
                disabled={isMinting || mintState === "error"}
                className={cn(
                  "btn-primary w-full text-base py-4 justify-center",
                  (isMinting || mintState === "error") && "opacity-60 cursor-not-allowed"
                )}
              >
                {mintButtonLabel()}
              </button>
            )}
          </div>
        )}

        {/* Address */}
        <p className="text-center text-xs text-zinc-600 font-mono break-all px-2">
          {address}
        </p>

        <div className="text-center">
          <Link href="/dashboard" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Page export — wraps MintContent in Suspense for useSearchParams ───────────

export default function MintPage() {
  const { address } = useParams<{ address: string }>();

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      }
    >
      <MintContent address={address} />
    </Suspense>
  );
}
