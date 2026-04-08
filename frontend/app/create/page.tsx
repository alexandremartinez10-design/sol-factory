"use client";

import { Suspense, useCallback, useEffect, useRef, useState, type FC } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { Upload, Loader2, AlertCircle, Zap } from "lucide-react";
import { NftPreviewCard } from "@/components/NftPreviewCard";
import { cn } from "@/lib/utils";
import {
  initializeCollection,
  type AnchorWallet,
} from "@/lib/solana";

// ── Animated launch steps ─────────────────────────────────────────────────────

const SIM_STEPS = [
  "Uploading your image...",
  "Creating your collection...",
  "Minting your first NFT...",
];

const REAL_STEPS = [
  "Uploading your artwork...",
  "Creating your collection...",
  "Minting NFT #1 to your wallet...",
  "Almost there...",
];

// Simulation: 3 steps × 1 s = 3 s total
const STEP_MS = 1000;

// ── Launch overlay ────────────────────────────────────────────────────────────

function LaunchOverlay({
  step,
  stepIndex,
  total,
  isSimulated,
}: {
  step: string;
  stepIndex: number;
  total: number;
  isSimulated: boolean;
}) {
  // Two-phase crossfade: fade old text out, then fade new text in from below
  const [displayStep, setDisplayStep] = useState(step);
  const [phase, setPhase] = useState<"in" | "out">("in");

  useEffect(() => {
    if (step === displayStep) return;
    setPhase("out");
    const t = setTimeout(() => {
      setDisplayStep(step);
      setPhase("in");
    }, 180);
    return () => clearTimeout(t);
  }, [step, displayStep]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-7 text-center px-6 max-w-sm">
        {/* Spinning logo */}
        <div className="relative w-20 h-20">
          <div
            className="absolute inset-0 rounded-full border-4 border-purple-500/30 animate-spin"
            style={{ borderTopColor: "#a855f7" }}
          />
          <div className="absolute inset-[6px] rounded-full bg-gradient-to-br from-violet-600 to-purple-500 flex items-center justify-center">
            <Zap className="w-6 h-6 text-white" />
          </div>
        </div>

        {/* Step text — smooth crossfade */}
        <div className="space-y-1.5 min-h-[3rem] overflow-hidden">
          <p
            className="text-white font-bold text-lg transition-all duration-200 ease-in-out"
            style={{
              opacity:   phase === "in" ? 1 : 0,
              transform: phase === "in" ? "translateY(0)" : "translateY(-6px)",
              transitionDuration: phase === "in" ? "280ms" : "160ms",
            }}
          >
            {displayStep}
          </p>
          {isSimulated && (
            <p className="text-yellow-400/80 text-sm font-medium">
              🧪 Simulation — no SOL spent
            </p>
          )}
        </div>

        {/* Progress dots */}
        <div className="flex gap-2">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-500",
                i <= stepIndex ? "w-6 bg-purple-500" : "w-1.5 bg-zinc-700"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Inner component (uses useSearchParams — must be inside Suspense) ──────────

function CreateForm() {
  const searchParams = useSearchParams();

  // Global error handler — catches uncaught errors including those from
  // async callbacks that aren't wrapped in try/catch
  useEffect(() => {
    const handleGlobalError = (msg: string | Event, src?: string, line?: number, col?: number, err?: Error) => {
      console.error("=== GLOBAL UNCAUGHT ERROR ===");
      console.error("MSG :", msg);
      console.error("SRC :", src, "line:", line, "col:", col);
      console.error("STACK:", err?.stack);
      console.error("=============================");
    };
    const handleUnhandledRejection = (e: PromiseRejectionEvent) => {
      console.error("=== UNHANDLED PROMISE REJECTION ===");
      console.error("REASON :", e.reason);
      console.error("STACK  :", e.reason?.stack);
      console.error("===================================");
    };
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    const prev = window.onerror;
    window.onerror = handleGlobalError;
    return () => {
      window.onerror = prev;
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);
  const isDevnet = searchParams.get("devnet") === "true";
  const { connected, publicKey, signTransaction, signAllTransactions, sendTransaction } =
    useWallet();
  const router = useRouter();

  // ── Form state ──────────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [supply, setSupply] = useState(100);
  const [mintPrice, setMintPrice] = useState(0.05);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [currentStep, setCurrentStep] = useState("");
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);
  const [previewUpdated, setPreviewUpdated] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clear any stale error state on mount (e.g. expired tx signatures from WSL testing)
  useEffect(() => { setLaunchError(null); }, []);

  // ── Helpers ─────────────────────────────────────────────────────────────
  const VALID_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

  function autoSymbol(n: string) {
    return n.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase();
  }

  function handleNameChange(n: string) {
    setName(n);
    if (!symbol || symbol === autoSymbol(name)) setSymbol(autoSymbol(n));
    flashPreview();
  }

  function flashPreview() {
    setPreviewUpdated(true);
    setTimeout(() => setPreviewUpdated(false), 600);
  }

  function processFile(file: File) {
    setFileError(null);
    if (!VALID_TYPES.includes(file.type)) {
      setFileError("Please upload a JPG, PNG, GIF, or WebP image.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setFileError("File must be under 50 MB.");
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
      flashPreview();
    };
    reader.readAsDataURL(file);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const canLaunch = !!name.trim() && !!imageFile && connected;

  // ── Animate through step labels ──────────────────────────────────────────
  async function runStepAnimation(steps: string[]): Promise<void> {
    for (let i = 0; i < steps.length; i++) {
      setCurrentStep(steps[i]);
      setCurrentStepIndex(i);
      await new Promise((r) => setTimeout(r, STEP_MS));
    }
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  async function handleLaunch() {
    if (!canLaunch || !publicKey || !signTransaction || !signAllTransactions)
      return;

    setIsLaunching(true);
    setLaunchError(null);
    setCurrentStepIndex(0);

    try {
      // devnet=true → always simulate (no SOL needed)
      const simulate = isDevnet;
      setIsSimulating(simulate);

      const steps = simulate ? SIM_STEPS : REAL_STEPS;

      if (simulate) {
        // ── SIMULATION PATH ─────────────────────────────────────────────
        // Create a blob URL from the selected file so /success shows the real image.
        const blobUrl = imageFile ? URL.createObjectURL(imageFile) : "";

        // Run animation concurrently with a fixed wait
        await Promise.all([
          runStepAnimation(steps),
          new Promise((r) => setTimeout(r, steps.length * STEP_MS)),
        ]);

        const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
        const fakeAddress = Array.from(
          { length: 44 },
          () => B58[Math.floor(Math.random() * B58.length)]
        ).join("");

        const params = new URLSearchParams({
          name,
          address: fakeAddress,
          image: blobUrl,
          symbol,
          supply: String(supply),
          mintPrice: String(mintPrice),
          simulated: "true",
        });
        router.push(`/success?${params.toString()}`);
        return;
      }

      // ── REAL PATH ────────────────────────────────────────────────────────

      // Step 1: Upload artwork
      setCurrentStep(steps[0]);
      setCurrentStepIndex(0);
      setUploadWarning(null);

      let imageUrl: string;
      let metadataUri: string;

      try {
        const formData = new FormData();
        formData.append("image", imageFile!);
        formData.append("name", name);
        formData.append("symbol", symbol);

        console.time("upload");
        console.log("[upload] Starting POST /api/upload", { name, symbol, fileSize: imageFile!.size, fileType: imageFile!.type });
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        console.timeEnd("upload");
        console.log("[upload] Response status:", uploadRes.status, uploadRes.ok ? "OK" : "FAILED");
        if (!uploadRes.ok) {
          const body = await uploadRes.json().catch(() => ({}));
          console.error("[upload] Error body:", body);
          throw new Error(body?.error ?? `Upload failed (${uploadRes.status})`);
        }
        const uploadJson = await uploadRes.json();
        console.log("[upload] Success:", uploadJson);
        ({ imageUrl, metadataUri } = uploadJson);
      } catch (uploadErr) {
        console.timeEnd("upload");
        console.error("[upload] FAILED — not falling back:", uploadErr instanceof Error ? uploadErr.message : uploadErr);
        throw new Error(`Image upload failed: ${uploadErr instanceof Error ? uploadErr.message : String(uploadErr)}`);
      }

      console.log("[create] Passing to initializeCollection:", { name, symbol, supply, mintPrice, metadataUri });

      // Step 2: Deploy collection
      setCurrentStep(steps[1]);
      setCurrentStepIndex(1);

      const wallet: AnchorWallet = {
        publicKey,
        signTransaction,
        signAllTransactions,
      };

      const { address: collectionState, collectionMint, signature } = await initializeCollection({
        wallet,
        sendTransaction,
        name,
        symbol,
        supply,
        mintPriceSol: mintPrice,
        metadataUri,
      });

      // Step 3: (reserved for future use)
      setCurrentStep(steps[2]);
      setCurrentStepIndex(2);

      // Redirect immediately — /success polls for on-chain confirmation in background
      console.log("[create] collectionState (PDA):", collectionState);
      console.log("[create] collectionMint (mpl-core asset):", collectionMint);
      console.log("[create] imageUrl being passed to /success:", imageUrl);
      router.push(
        `/success?name=${encodeURIComponent(name)}&address=${encodeURIComponent(collectionState)}&collectionMint=${encodeURIComponent(collectionMint)}&image=${encodeURIComponent(imageUrl)}&symbol=${encodeURIComponent(symbol)}&supply=${supply}&mintPrice=${mintPrice}&signature=${encodeURIComponent(signature)}`
      );
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      console.error("=== LAUNCH ERROR (full) ===");
      console.error("FULL ERR :", e);
      console.error("MESSAGE  :", e?.message);
      console.error("NAME     :", e?.name);
      console.error("STACK    :", e?.stack);
      try { console.error("JSON     :", JSON.stringify(e, Object.getOwnPropertyNames(e))); } catch {}
      console.error("==========================");
      const msg = e?.message ?? "Transaction failed. Try again.";
      setLaunchError(msg);
    } finally {
      setIsLaunching(false);
      setCurrentStep("");
    }
  }

  return (
    <>
      {/* Full-screen launch overlay */}
      {isLaunching && currentStep && (
        <LaunchOverlay
          step={currentStep}
          stepIndex={currentStepIndex}
          total={(isSimulating ? SIM_STEPS : REAL_STEPS).length}
          isSimulated={isSimulating}
        />
      )}

      <div className="mx-auto max-w-7xl px-4 py-12">
        {/* Page header */}
        <div className="mb-10 text-center sm:text-left">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
            Create your collection
          </h1>
          <p className="mt-2 text-zinc-400 text-sm">
            Fill in the details on the left and watch your NFT come to life on
            the right.
          </p>
        </div>

        {isDevnet && (
          <div className="mb-8 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-yellow-500/30 bg-yellow-500/10 text-yellow-300 text-sm font-semibold">
            <span className="text-base">🧪</span>
            DEVNET MODE — No SOL? We&apos;ll simulate the full flow for free
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-10 items-start">
          {/* ── LEFT: Form ────────────────────────────────────────────────── */}
          <div className="space-y-6">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-zinc-300">
                Collection name <span className="text-purple-400">*</span>
              </label>
              <input
                className="input"
                placeholder="e.g. Cosmic Creatures"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                maxLength={32}
              />
            </div>

            {/* Symbol */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-zinc-300">
                Symbol
                <span className="ml-2 text-xs text-zinc-500 font-normal">
                  (auto-generated, editable)
                </span>
              </label>
              <input
                className="input font-mono uppercase"
                placeholder="COSM"
                value={symbol}
                onChange={(e) => {
                  setSymbol(
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, "")
                      .slice(0, 4)
                  );
                  flashPreview();
                }}
                maxLength={4}
              />
            </div>

            {/* Supply + Mint price */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-zinc-300">
                  Total supply
                </label>
                <input
                  type="number"
                  className="input"
                  min={1}
                  max={10000}
                  value={supply}
                  onChange={(e) => {
                    setSupply(Number(e.target.value));
                    flashPreview();
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-zinc-300">
                  Mint price (SOL)
                </label>
                <input
                  type="number"
                  className="input"
                  min={0}
                  step={0.01}
                  value={mintPrice}
                  onChange={(e) => {
                    setMintPrice(Number(e.target.value));
                    flashPreview();
                  }}
                />
              </div>
            </div>

            {/* Image upload */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-zinc-300">
                Collection image <span className="text-purple-400">*</span>
              </label>

              <div
                className={cn(
                  "relative rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer",
                  isDragging
                    ? "border-purple-500 bg-purple-500/10"
                    : imagePreview
                    ? "border-zinc-700 bg-zinc-900"
                    : "border-zinc-700 hover:border-zinc-500 bg-zinc-900/50"
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                {imagePreview ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full max-h-64 object-contain rounded-2xl"
                    />
                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
                      <p className="text-sm text-white font-medium">
                        Click to replace
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center">
                      <Upload className="w-6 h-6 text-zinc-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-300">
                        Drop your image here, or click to browse
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        JPG, PNG, GIF, WebP · Max 50 MB
                      </p>
                    </div>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) processFile(f);
                  }}
                />
              </div>

              {fileError && (
                <p className="flex items-center gap-1.5 text-xs text-red-400">
                  <AlertCircle className="w-3.5 h-3.5" /> {fileError}
                </p>
              )}
            </div>

            {/* Urgency */}
            <p className="text-sm text-amber-400 font-medium">
              ⚡ Only a few spots left for early featured collections
            </p>

            {/* Wallet gate */}
            {!connected && (
              <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 text-sm text-zinc-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-zinc-500 shrink-0" />
                Connect your wallet above before launching.
              </div>
            )}

            {/* Upload warning */}
            {uploadWarning && (
              <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-300 flex items-start gap-2">
                <span className="shrink-0">🧪</span>
                <span>{uploadWarning}</span>
              </div>
            )}

            {/* Launch error */}
            {launchError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{launchError}</span>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleLaunch}
              disabled={!canLaunch || isLaunching}
              className="btn-primary w-full text-base py-4"
            >
              {isLaunching ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {currentStep || "Launching…"}
                </>
              ) : (
                `Launch my collection${isDevnet ? " (Devnet)" : " (0.15 SOL)"}`
              )}
            </button>
          </div>

          {/* ── RIGHT: Live NFT preview ──────────────────────────────────── */}
          <div className="lg:sticky lg:top-24 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 text-center">
              Live Preview
            </p>
            <NftPreviewCard
              name={name}
              symbol={symbol}
              supply={supply}
              mintPrice={mintPrice}
              imageUrl={imagePreview ?? undefined}
              animated={previewUpdated}
            />
          </div>
        </div>
      </div>
    </>
  );
}

// ── Page export with Suspense (required for useSearchParams) ──────────────────

export default function CreatePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      }
    >
      <CreateForm />
    </Suspense>
  );
}
