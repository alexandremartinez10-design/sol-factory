import Link from "next/link";
import {
  Wallet, Upload, SlidersHorizontal, Zap, Star,
  DollarSign, TrendingUp, Lock, Cloud, Shield, Rocket,
} from "lucide-react";
import { AnimatedCounter } from "@/components/AnimatedCounter";

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
    desc: "Set mint price, supply. Funds go directly to your wallet.",
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
          Early creators get featured on the homepage
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

        {/* Trust line */}
        <p
          className="animate-fade-up mt-6 text-sm text-zinc-500"
          style={{ animationDelay: "400ms" }}
        >
          <span className="text-purple-400 font-medium">
            Early creators get featured on the homepage
          </span>{" "}
          — Limited spots available
        </p>

        {/* Animated counter */}
        <div
          className="animate-fade-up mt-10"
          style={{ animationDelay: "480ms" }}
        >
          <AnimatedCounter />
        </div>
      </section>

      {/* ── Featured Collections ─────────────────────────────────────────── */}
      <section className="py-20 px-4 animate-fade-up" style={{ animationDelay: "100ms" }}>
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-10">
            Featured Collections
          </h2>
          <div className="grid sm:grid-cols-2 gap-5">
            {[
              {
                name: "test08044",
                href: "https://solfactory.pro/mint/AVdqT5JVNXZpMdNVunuKzNG9wMhoNFvu1vEzG9C5hpWt",
              },
              {
                name: "tresa",
                href: "https://solfactory.pro/mint/9ws8z9DcJPkqPEgbuzG6jaP63yCXvqwP5mDSfD926SsC",
              },
            ].map((c) => (
              <div
                key={c.name}
                className="card p-6 flex flex-col items-center gap-4 text-center hover:border-purple-500/40 hover:-translate-y-1 transition-all duration-300"
              >
                <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                  <Star className="w-7 h-7 text-purple-400 fill-purple-400/20" />
                </div>
                <h3 className="font-bold text-white text-lg">{c.name}</h3>
                <a href={c.href} className="btn-primary text-sm px-6 py-2.5">
                  Mint now
                </a>
              </div>
            ))}
          </div>
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
            <Link
              href="/create"
              className="btn-primary text-base px-10 py-4 inline-flex shadow-lg shadow-purple-900/30"
            >
              Claim my spot — 0.15 SOL
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
