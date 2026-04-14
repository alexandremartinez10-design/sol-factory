import Link from "next/link";
import {
  Wallet, Upload, SlidersHorizontal, Zap, Star,
  DollarSign, TrendingUp, Lock, Cloud, Shield, Rocket,
  CheckCircle2,
} from "lucide-react";

// ── How it works ──────────────────────────────────────────────────────────────

const HOW_IT_WORKS = [
  {
    icon: <Wallet className="w-6 h-6 text-purple-400" />,
    title: "Connect Your Wallet",
    desc: "Connect Phantom or Solflare. No email needed.",
  },
  {
    icon: <Upload className="w-6 h-6 text-purple-400" />,
    title: "Upload Your Artwork",
    desc: "Drag & drop PNG, JPG or GIF. We handle IPFS automatically.",
  },
  {
    icon: <SlidersHorizontal className="w-6 h-6 text-purple-400" />,
    title: "Configure Your Collection",
    desc: "Set mint price, supply, and your royalty percentage. Funds go directly to your wallet.",
  },
  {
    icon: <Zap className="w-6 h-6 text-purple-400" />,
    title: "Go Live in One Click",
    desc: "Deploy on Solana Mainnet. Get your mint link instantly.",
  },
];

// ── Why SolFactory feature cards ──────────────────────────────────────────────

const FEATURES = [
  {
    icon: <DollarSign className="w-6 h-6 text-purple-400" />,
    title: "Ultra Low Cost",
    desc: "Only 0.15 SOL one-time fee. No subscriptions, no hidden costs.",
  },
  {
    icon: <TrendingUp className="w-6 h-6 text-purple-400" />,
    title: "Zero Commission",
    desc: "Keep 100% of your mint sales and royalties. We take nothing.",
  },
  {
    icon: <Lock className="w-6 h-6 text-purple-400" />,
    title: "Full Ownership",
    desc: "The smart contract is 100% yours. Fully verifiable on Solana Explorer.",
  },
  {
    icon: <Cloud className="w-6 h-6 text-purple-400" />,
    title: "Automatic IPFS",
    desc: "We handle all technical parts — images, JSON files, and pinning.",
  },
  {
    icon: <Shield className="w-6 h-6 text-purple-400" />,
    title: "Mainnet Ready",
    desc: "Launch directly on Solana Mainnet. No Devnet stress.",
  },
  {
    icon: <Rocket className="w-6 h-6 text-purple-400" />,
    title: "Early Creator Boost",
    desc: "First creators get featured on the homepage for maximum visibility.",
  },
];

// ── Royalties breakdown ───────────────────────────────────────────────────────

const ROYALTY_POINTS = [
  "With 8% royalties, you earn on every secondary sale — forever",
  "SolFactory takes 0% ongoing commission. Ever.",
  "Royalties are encoded in the smart contract and fully on-chain",
];

// ── Featured collections (marketing examples — not real user collections) ─────
// TODO: replace imgSrc values with real curated IPFS artwork when available

const FEATURED = [
  {
    name: "Cosmic Apes",
    symbol: "CAPE",
    supply: "1,000",
    imgSrc: "https://picsum.photos/seed/cosmicapes/600/600",
    imgAlt: "Cosmic Apes NFT — generative ape collection on Solana",
  },
  {
    name: "Neon Dreams",
    symbol: "NDRM",
    supply: "500",
    imgSrc: "https://picsum.photos/seed/neondreams/600/600",
    imgAlt: "Neon Dreams NFT — cyberpunk generative art collection",
  },
  {
    name: "Shadow Legion",
    symbol: "SLEG",
    supply: "2,000",
    imgSrc: "https://picsum.photos/seed/shadowlegion/600/600",
    imgAlt: "Shadow Legion NFT — dark fantasy warrior collection",
  },
  {
    name: "Pixel Punks",
    symbol: "PPNK",
    supply: "888",
    imgSrc: "https://picsum.photos/seed/pixelpunks/600/600",
    imgAlt: "Pixel Punks NFT — retro pixel art collection on Solana",
  },
  {
    name: "Aurora Wolves",
    symbol: "AWLF",
    supply: "777",
    imgSrc: "https://picsum.photos/seed/aurorawolves/600/600",
    imgAlt: "Aurora Wolves NFT — nature-inspired generative collection",
  },
  {
    name: "Void Walkers",
    symbol: "VOID",
    supply: "333",
    imgSrc: "https://picsum.photos/seed/voidwalkers/600/600",
    imgAlt: "Void Walkers NFT — abstract sci-fi collection on Solana",
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center text-center px-4 pt-24 pb-36 overflow-hidden">
        {/* Background glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 90% 55% at 50% -5%, rgba(124,58,237,0.22) 0%, transparent 68%)",
          }}
        />

        {/* Badge */}
        <div
          className="mb-8 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-sm font-medium animate-fade-up"
          style={{ animationDelay: "0ms" }}
        >
          <Star className="w-3.5 h-3.5 fill-current" />
          Early access — be one of the first creators
        </div>

        {/* H1 */}
        <h1
          className="animate-fade-up text-5xl sm:text-6xl md:text-7xl font-extrabold text-white leading-[1.06] max-w-4xl mx-auto tracking-tight"
          style={{ animationDelay: "80ms" }}
        >
          Launch Your Solana NFT
          <br />
          Collection in{" "}
          <span className="gradient-text">60 Seconds</span>
        </h1>

        {/* Subtitle */}
        <p
          className="animate-fade-up mt-7 text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed"
          style={{ animationDelay: "160ms" }}
        >
          No code. No setup. No complicated tools. Just connect your wallet,
          upload your art, and go live on Mainnet instantly.
        </p>

        {/* Inline trust badges */}
        <div
          className="animate-fade-up mt-8 flex flex-wrap items-center justify-center gap-3"
          style={{ animationDelay: "240ms" }}
        >
          {[
            "0.15 SOL one-time fee",
            "0% commission forever",
            "Full smart contract ownership",
          ].map((label) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/8 text-emerald-300 text-xs font-semibold"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              {label}
            </span>
          ))}
        </div>

        {/* CTA buttons */}
        <div
          className="animate-fade-up mt-10 flex flex-col sm:flex-row gap-4 justify-center"
          style={{ animationDelay: "320ms" }}
        >
          <Link
            href="/create"
            className="btn-primary text-base px-9 py-4 shadow-lg shadow-purple-900/30"
          >
            Launch My Collection Now
          </Link>
          <Link
            href="/create?devnet=true"
            className="btn-ghost text-base px-9 py-4"
          >
            Try Devnet for Free
          </Link>
        </div>

        {/* Royalties note */}
        <p
          className="animate-fade-up mt-5 text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed"
          style={{ animationDelay: "380ms" }}
        >
          Standard 8% royalties. SolFactory takes{" "}
          <span className="text-emerald-400 font-semibold">0% commission</span>{" "}
          on sales — now and forever.
        </p>

        {/* Early access note */}
        <p
          className="animate-fade-up mt-4 text-sm text-zinc-500"
          style={{ animationDelay: "440ms" }}
        >
          <span className="text-purple-400 font-medium">
            SolFactory is in early access
          </span>{" "}
          — featured spots are limited
        </p>
      </section>

      {/* ── Featured Collections ─────────────────────────────────────────── */}
      <section className="py-20 px-4 animate-fade-up" style={{ animationDelay: "100ms" }}>
        <div className="mx-auto max-w-6xl">
          {/* Section header */}
          <div className="text-center mb-12 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-purple-400">
              Built with SolFactory
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Collections on SolFactory
            </h2>
            <p className="text-zinc-500 text-sm max-w-sm mx-auto">
              Launch yours in 60 seconds. No code required.
            </p>
          </div>

          {/* Grid: 2 col mobile → 3 col md → 3 col lg */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5">
            {FEATURED.map((c) => (
              /* Non-clickable display card */
              <div
                key={c.name}
                className="card overflow-hidden group hover:border-purple-500/40 hover:-translate-y-1.5 transition-all duration-300 cursor-default"
              >
                {/* NFT image — 1:1 aspect ratio */}
                {/* TODO: remplacer imgSrc par l'URL IPFS réelle de la collection */}
                <div className="relative w-full aspect-square overflow-hidden bg-zinc-900">
                  <img
                    src={c.imgSrc}
                    alt={c.imgAlt}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />

                  {/* Bottom gradient overlay */}
                  <div
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-2/5 pointer-events-none"
                    style={{
                      background:
                        "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)",
                    }}
                  />

                  {/* Symbol tag top-right */}
                  <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold tracking-wide">
                    {c.symbol}
                  </div>

                  {/* Supply badge top-left */}
                  <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-purple-600/70 backdrop-blur-sm text-white text-[10px] font-semibold">
                    {c.supply} items
                  </div>

                  {/* Name overlay bottom */}
                  <div className="absolute bottom-0 inset-x-0 px-3 py-2.5">
                    <p className="font-bold text-white text-sm leading-tight truncate">
                      {c.name}
                    </p>
                  </div>
                </div>

                {/* Card footer */}
                <div className="px-3 py-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                  <p className="text-[11px] text-zinc-500 font-medium truncate">
                    Minted on SolFactory
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA below grid */}
          <p className="text-center mt-10 text-sm text-zinc-500">
            Your collection could be here.{" "}
            <Link href="/create" className="text-purple-400 hover:text-purple-300 font-semibold transition-colors">
              Launch yours →
            </Link>
          </p>
        </div>
      </section>

      {/* ── Value Banner ─────────────────────────────────────────────────── */}
      <div
        className="relative w-full py-8 overflow-hidden"
        style={{ background: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 200% at 50% 50%, rgba(255,255,255,0.10) 0%, transparent 70%)",
          }}
        />
        <p
          className="relative text-center text-white font-bold text-xl sm:text-2xl px-6 tracking-tight"
          style={{ textShadow: "0 2px 20px rgba(124,58,237,0.5)" }}
        >
          🔒 Pay 0.15 SOL once. Keep 100% of your royalties. Forever.
        </p>
      </div>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="py-28 px-4">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              How it works
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {HOW_IT_WORKS.map((step, i) => (
              <div
                key={i}
                className="card p-8 text-center space-y-4 hover:border-purple-500/40 hover:-translate-y-1.5 transition-all duration-300"
              >
                <div className="relative inline-flex mx-auto">
                  <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                    {step.icon}
                  </div>
                  <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                </div>
                <h3 className="font-bold text-white text-base">{step.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-purple-300 font-medium mt-10">
            ⚡ Most creators launch in under 60 seconds
          </p>
        </div>
      </section>

      {/* ── Why SolFactory ───────────────────────────────────────────────── */}
      <section className="py-28 px-4">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16 space-y-3">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Why Creators Choose SolFactory
            </h2>
            <p className="text-zinc-400 text-base max-w-xl mx-auto">
              Everything you need to launch — nothing you don&apos;t.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="card p-7 space-y-4 hover:border-purple-500/40 hover:-translate-y-1.5 transition-all duration-300 group"
              >
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors duration-300">
                  {f.icon}
                </div>
                <h3 className="font-bold text-white text-base">{f.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border border-zinc-700 bg-zinc-900/60 px-6 py-5 max-w-lg mx-auto text-center">
            <p className="text-sm text-zinc-400 leading-relaxed">
              <span className="text-zinc-200 font-semibold">
                This isn&apos;t a promise. It&apos;s written in the smart contract.
              </span>{" "}
              Anyone can verify it on-chain.
            </p>
          </div>
        </div>
      </section>

      {/* ── Royalties breakdown ───────────────────────────────────────────── */}
      <section className="py-20 px-4">
        <div className="mx-auto max-w-3xl">
          <div className="card p-8 sm:p-10 space-y-6 border-purple-500/20">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-purple-400">
                Your Royalties
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">
                You keep everything
              </h2>
              <p className="text-zinc-400 text-sm leading-relaxed">
                We encoded zero platform fees in the contract — there&apos;s nothing
                to trust, just read the code.
              </p>
            </div>

            <ul className="space-y-3">
              {ROYALTY_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm text-zinc-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  {point}
                </li>
              ))}
            </ul>

            <div className="pt-2 border-t border-zinc-800">
              <p className="text-xs text-zinc-500 leading-relaxed">
                Example: with 8% royalties and 1,000 secondary sales at 1 SOL each →{" "}
                <span className="text-emerald-400 font-semibold">80 SOL earned passively</span>.
                SolFactory receives 0 SOL.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Social proof / Transparency note ─────────────────────────────── */}
      <section className="py-16 px-4">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 px-8 py-8 text-center space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-purple-400">
              A note from the team
            </p>
            <p className="text-zinc-200 text-base leading-relaxed">
              SolFactory just launched. The first creators are already live.{" "}
              <span className="text-white font-semibold">
                Be one of the early ones and get featured while spots are still open.
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ────────────────────────────────────────────────────── */}
      <section className="py-28 px-4">
        <div className="mx-auto max-w-3xl">
          <div className="card p-10 sm:p-16 text-center glow-purple space-y-6">
            <p className="text-4xl">🌟</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
              Early creators get featured
              <br />
              on the homepage
            </h2>
            <p className="text-zinc-400 max-w-md mx-auto">
              Launch now while spots are still open. Featured collections get{" "}
              <span className="text-purple-300 font-semibold">10× more visibility</span>.
            </p>
            <div className="flex flex-col items-center gap-3">
              <Link
                href="/create"
                className="btn-primary text-base px-10 py-4 inline-flex shadow-lg shadow-purple-900/30"
              >
                Claim my spot — 0.15 SOL
              </Link>
              <p className="text-xs text-zinc-600">
                One-time fee · 0% commission · Your royalties, your rules
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
