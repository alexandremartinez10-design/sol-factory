// app/page.tsx — SolFactory premium homepage (v3 — "50k$ glow-up")

import Link from "next/link";
import {
  Wallet, Upload, SlidersHorizontal, Zap, Star, Sparkles,
  DollarSign, TrendingUp, Lock, Cloud, Shield, Rocket,
  CheckCircle2, ArrowRight, ChevronDown, Check, X, Clock, Coins, Code2,
} from "lucide-react";

// ── How it works ──────────────────────────────────────────────────────────────

const HOW_IT_WORKS = [
  {
    icon: <Wallet className="w-5 h-5 text-purple-300" />,
    title: "Connect Your Wallet",
    desc: "Connect Phantom or Solflare. No email needed.",
  },
  {
    icon: <Upload className="w-5 h-5 text-purple-300" />,
    title: "Upload Your Artwork",
    desc: "Drag & drop PNG, JPG or GIF. We handle IPFS automatically.",
  },
  {
    icon: <SlidersHorizontal className="w-5 h-5 text-purple-300" />,
    title: "Configure Your Collection",
    desc: "Set mint price and supply. 8% royalties applied automatically.",
  },
  {
    icon: <Zap className="w-5 h-5 text-purple-300" />,
    title: "Go Live in One Click",
    desc: "Deploy on Solana Mainnet. Get your mint link instantly.",
  },
];

// ── Why SolFactory ────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: <DollarSign className="w-5 h-5 text-purple-300" />,
    title: "Ultra Low Cost",
    desc: "Only 0.15 SOL one-time fee. No subscriptions, no hidden costs.",
  },
  {
    icon: <TrendingUp className="w-5 h-5 text-purple-300" />,
    title: "Zero Commission",
    desc: "Keep 100% of your mint sales and royalties. We take nothing.",
  },
  {
    icon: <Lock className="w-5 h-5 text-purple-300" />,
    title: "Full Ownership",
    desc: "The smart contract is 100% yours. Verifiable on Solana Explorer.",
  },
  {
    icon: <Cloud className="w-5 h-5 text-purple-300" />,
    title: "Automatic IPFS",
    desc: "We handle all technical parts — images, JSON files, and pinning.",
  },
  {
    icon: <Shield className="w-5 h-5 text-purple-300" />,
    title: "Mainnet Ready",
    desc: "Launch directly on Solana Mainnet. No Devnet stress.",
  },
  {
    icon: <Rocket className="w-5 h-5 text-purple-300" />,
    title: "Early Creator Boost",
    desc: "First creators get featured on the homepage for maximum visibility.",
  },
];

// ── Royalties ─────────────────────────────────────────────────────────────────

const ROYALTY_POINTS = [
  "With 8% royalties, you earn on every secondary sale — forever",
  "SolFactory takes 0% ongoing commission. Ever.",
  "Royalties are encoded in the smart contract and fully on-chain",
];

// ── Featured collections ──────────────────────────────────────────────────────

const FEATURED = [
  { name: "Lunar Eclipse", symbol: "LUNA", supply: "500", imgSrc: "/lunar-eclipse.png.jpg", imgAlt: "Lunar Eclipse NFT" },
  { name: "Arcane Circle", symbol: "ARCN", supply: "200", imgSrc: "/arcane-circle.png.jpg", imgAlt: "Arcane Circle NFT" },
  { name: "Crystal Spirit", symbol: "CRYS", supply: "300", imgSrc: "/crystal-spirit.png.jpg", imgAlt: "Crystal Spirit NFT" },
  { name: "Neon Phantom", symbol: "NPHM", supply: "500", imgSrc: "/neon-phantom.png.jpg", imgAlt: "Neon Phantom NFT" },
  { name: "Aurora Wolves", symbol: "AWLF", supply: "200", imgSrc: "/aurora-wolves.png.jpg", imgAlt: "Aurora Wolves NFT" },
  { name: "Legendary Skin Pass", symbol: "LGND", supply: "100", imgSrc: "/legendary-skin-pass.png.jpg", imgAlt: "Legendary Skin Pass NFT" },
];

// Double for marquee (infinite loop)
const MARQUEE_ITEMS = [...FEATURED, ...FEATURED];

// ── Comparison data ───────────────────────────────────────────────────────────

type Row = { label: string; sf: string; others: string; sfOk: boolean; othersOk: boolean };
const COMPARISON: Row[] = [
  { label: "Platform commission",   sf: "0%",          others: "2–5%",         sfOk: true,  othersOk: false },
  { label: "Deployment cost",       sf: "0.15 SOL",    others: "$500–2000",    sfOk: true,  othersOk: false },
  { label: "Time to launch",        sf: "60 seconds",  others: "Days / weeks", sfOk: true,  othersOk: false },
  { label: "Code required",         sf: "None",        others: "Solidity / Rust", sfOk: true, othersOk: false },
  { label: "IPFS hosting included", sf: "Yes",         others: "Extra service",   sfOk: true, othersOk: false },
  { label: "Smart contract ownership", sf: "100% yours", others: "Platform-owned", sfOk: true, othersOk: false },
  { label: "Royalties you keep",    sf: "100% of 8%",  others: "Shared / capped", sfOk: true, othersOk: false },
];

// ── FAQ ───────────────────────────────────────────────────────────────────────

const FAQ = [
  {
    q: "Do I really pay nothing but 0.15 SOL?",
    a: "Yes. One-time 0.15 SOL deployment fee. No subscription, no platform cut on mint sales, no cut on royalties. The smart contract is public — anyone can verify it on-chain.",
  },
  {
    q: "How long does it take to launch?",
    a: "Most creators deploy in under 60 seconds from wallet connection to live mint page. Upload your art, set supply + price, click deploy. That's it.",
  },
  {
    q: "Do I own the smart contract?",
    a: "Yes. The Metaplex Core collection and all NFTs minted through SolFactory are owned entirely by your wallet. SolFactory has no administrative authority after initialization.",
  },
  {
    q: "Are royalties really enforced?",
    a: "Royalties (8%) are encoded directly in the Metaplex Core metadata via the Royalties plugin. Enforcement on secondary sales depends on marketplace policy (Tensor, Magic Eden both support it).",
  },
  {
    q: "What about IPFS? Do I need a Pinata account?",
    a: "No. SolFactory handles IPFS pinning automatically — images, JSON metadata, everything. It's included in the 0.15 SOL fee.",
  },
  {
    q: "Can I mint on Devnet to test first?",
    a: "Yes. We offer a free Devnet mode so you can test the full flow without spending real SOL. Use the 'Try Devnet for Free' button on the homepage.",
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <>
      {/* ══════════════════════════════════════════════════════════════════════
          HERO — 2-col desktop, animated NFT stack on the right
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="relative pt-20 pb-28 lg:pt-28 lg:pb-40 px-4 overflow-hidden">
        <div className="mx-auto max-w-7xl grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-8 items-center">

          {/* ── LEFT : Content ─────────────────────────────────────────────── */}
          <div className="text-center lg:text-left">
            {/* Badge premium */}
            <div
              className="animate-fade-up inline-flex items-center gap-2 px-4 py-2 rounded-full
                         border border-purple-500/40 bg-purple-500/10 text-purple-200 text-sm font-medium
                         backdrop-blur-md shadow-[0_0_32px_rgba(153,69,255,0.15)] mb-8"
              style={{ animationDelay: "0ms" }}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              Live on Solana Mainnet
              <span className="text-purple-400">·</span>
              <span className="text-emerald-300">Early access open</span>
            </div>

            {/* H1 */}
            <h1
              className="animate-fade-up text-5xl sm:text-6xl md:text-7xl font-extrabold text-white leading-[1.04] tracking-tight"
              style={{ animationDelay: "80ms" }}
            >
              Launch Your{" "}
              <span className="gradient-text-solana">Solana NFT</span>
              <br />
              Collection in{" "}
              <span className="gradient-text">60 Seconds</span>
            </h1>

            {/* Subtitle */}
            <p
              className="animate-fade-up mt-7 text-lg sm:text-xl text-zinc-400 max-w-xl mx-auto lg:mx-0 leading-relaxed"
              style={{ animationDelay: "160ms" }}
            >
              No code. No setup. Just connect your wallet, upload your art,
              and go live on Mainnet — while keeping{" "}
              <span className="text-white font-semibold">100% of your sales</span>.
            </p>

            {/* Inline stats strip */}
            <div
              className="animate-fade-up mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-6 sm:gap-8"
              style={{ animationDelay: "240ms" }}
            >
              {[
                { value: "0.15 SOL", label: "one-time fee" },
                { value: "0%",       label: "commission" },
                { value: "60s",      label: "to deploy" },
              ].map((s) => (
                <div key={s.label} className="flex flex-col items-center lg:items-start">
                  <span className="gradient-text-solana font-extrabold text-2xl sm:text-3xl stat-number">
                    {s.value}
                  </span>
                  <span className="text-zinc-500 text-xs uppercase tracking-widest font-semibold">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div
              className="animate-fade-up mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
              style={{ animationDelay: "320ms" }}
            >
              <Link href="/create" className="btn-primary text-base px-10 py-4">
                <Sparkles className="w-4 h-4" />
                Launch My Collection
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/create?devnet=true" className="btn-ghost text-base px-10 py-4">
                Try Devnet for Free
              </Link>
            </div>

            {/* Trust note */}
            <p
              className="animate-fade-up mt-6 text-xs text-zinc-500 max-w-sm mx-auto lg:mx-0 leading-relaxed"
              style={{ animationDelay: "400ms" }}
            >
              Standard 8% royalties.{" "}
              <span className="text-emerald-400 font-semibold">0% commission</span>{" "}
              on sales — now and forever. Smart contract{" "}
              <a href="https://explorer.solana.com" target="_blank" rel="noopener noreferrer"
                 className="text-purple-300 hover:text-purple-200 underline underline-offset-2 decoration-purple-500/40">
                verifiable on-chain
              </a>.
            </p>
          </div>

          {/* ── RIGHT : Floating NFT stack (desktop only) ────────────────── */}
          <div
            className="hidden lg:flex relative h-[520px] items-center justify-center animate-fade-in"
            style={{ animationDelay: "200ms" }}
          >
            {/* Pulsing ambient glow behind cards */}
            <div
              aria-hidden
              className="absolute inset-0 pulse-glow -z-10"
              style={{
                background:
                  "radial-gradient(circle at 50% 50%, rgba(153,69,255,0.35) 0%, rgba(20,241,149,0.12) 40%, transparent 70%)",
                filter: "blur(40px)",
              }}
            />

            {/* Card 1 — back left */}
            <div
              className="absolute top-8 left-4 w-52 h-64 rounded-2xl overflow-hidden float-1
                         shadow-[0_24px_60px_-12px_rgba(153,69,255,0.45)]
                         border border-white/10"
              style={{ transform: "rotate(-8deg)" }}
            >
              <img src={FEATURED[1].imgSrc} alt={FEATURED[1].imgAlt}
                   className="w-full h-full object-cover" loading="eager" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-3 right-3">
                <p className="text-[10px] uppercase tracking-widest text-purple-300 font-bold">{FEATURED[1].symbol}</p>
                <p className="text-white font-bold text-sm truncate">{FEATURED[1].name}</p>
              </div>
            </div>

            {/* Card 2 — center (front) */}
            <div
              className="relative w-60 h-72 rounded-2xl overflow-hidden float-2 z-10
                         shadow-[0_32px_80px_-12px_rgba(153,69,255,0.6)]
                         border border-white/15"
            >
              <img src={FEATURED[3].imgSrc} alt={FEATURED[3].imgAlt}
                   className="w-full h-full object-cover" loading="eager" />
              {/* Shine overlay */}
              <div
                aria-hidden
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 40%, transparent 60%, rgba(153,69,255,0.2) 100%)",
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
              {/* Badge "Live" */}
              <div className="absolute top-3 left-3 px-2 py-1 rounded-md bg-emerald-500/20 border border-emerald-400/40 backdrop-blur-md">
                <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest">● Live</span>
              </div>
              <div className="absolute top-3 right-3 px-2 py-1 rounded-md bg-black/50 backdrop-blur-md border border-white/10">
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">{FEATURED[3].symbol}</span>
              </div>
              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-white font-extrabold text-base leading-tight">{FEATURED[3].name}</p>
                <p className="text-zinc-300 text-xs mt-1">{FEATURED[3].supply} items · 8% royalties</p>
              </div>
            </div>

            {/* Card 3 — back right */}
            <div
              className="absolute top-12 right-4 w-52 h-64 rounded-2xl overflow-hidden float-3
                         shadow-[0_24px_60px_-12px_rgba(59,130,246,0.40)]
                         border border-white/10"
              style={{ transform: "rotate(6deg)" }}
            >
              <img src={FEATURED[4].imgSrc} alt={FEATURED[4].imgAlt}
                   className="w-full h-full object-cover" loading="eager" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-3 right-3">
                <p className="text-[10px] uppercase tracking-widest text-blue-300 font-bold">{FEATURED[4].symbol}</p>
                <p className="text-white font-bold text-sm truncate">{FEATURED[4].name}</p>
              </div>
            </div>

            {/* Floating mint receipt */}
            <div
              className="absolute bottom-6 -left-4 px-4 py-3 rounded-xl
                         bg-black/70 backdrop-blur-xl border border-white/10
                         shadow-2xl float-3"
              style={{ animationDelay: "1s" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Mint confirmed</p>
                  <p className="text-white font-bold text-xs">+1 SOL → creator</p>
                </div>
              </div>
            </div>

            {/* Floating "0% fee" chip */}
            <div
              className="absolute top-4 -right-2 px-3 py-2 rounded-xl
                         bg-gradient-to-br from-emerald-500/20 to-emerald-600/10
                         border border-emerald-400/40 backdrop-blur-xl
                         shadow-[0_0_32px_rgba(20,241,149,0.25)]
                         float-1"
              style={{ animationDelay: "0.5s" }}
            >
              <p className="text-[10px] text-emerald-300 font-bold uppercase tracking-widest">Platform fee</p>
              <p className="text-white font-extrabold text-lg stat-number">0%</p>
            </div>
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════════════════════
          MARQUEE — Collections live, infinite scroll
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-10 overflow-hidden">
        <div className="text-center mb-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-purple-400">
            Collections launching on SolFactory
          </p>
        </div>

        <div className="marquee-mask relative">
          <div className="marquee-track-left flex gap-4 w-max">
            {MARQUEE_ITEMS.map((c, i) => (
              <div
                key={`l-${i}`}
                className="shrink-0 w-48 h-48 rounded-2xl overflow-hidden relative
                           border border-white/10 bg-zinc-900
                           hover:border-purple-500/50 transition-colors duration-300"
              >
                <img src={c.imgSrc} alt={c.imgAlt} className="w-full h-full object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                <div className="absolute inset-0" style={{ background: "rgba(20,5,40,0.2)", mixBlendMode: "multiply" }} />
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10">
                  <span className="text-[9px] font-bold text-white uppercase tracking-widest">{c.symbol}</span>
                </div>
                <div className="absolute bottom-3 left-3 right-3">
                  <p className="text-white font-bold text-sm truncate">{c.name}</p>
                  <p className="text-zinc-400 text-[10px] mt-0.5">{c.supply} items</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="marquee-mask relative mt-4">
          <div className="marquee-track-right flex gap-4 w-max">
            {[...MARQUEE_ITEMS].reverse().map((c, i) => (
              <div
                key={`r-${i}`}
                className="shrink-0 w-40 h-40 rounded-2xl overflow-hidden relative
                           border border-white/10 bg-zinc-900
                           hover:border-purple-500/50 transition-colors duration-300"
              >
                <img src={c.imgSrc} alt={c.imgAlt} className="w-full h-full object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                <div className="absolute inset-0" style={{ background: "rgba(20,5,40,0.2)", mixBlendMode: "multiply" }} />
                <div className="absolute bottom-2 left-2.5 right-2.5">
                  <p className="text-white font-bold text-xs truncate">{c.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════════════════════
          GIANT STATS — 4 KPI massifs
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-4">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {[
              { value: "0%",        label: "Platform commission",       sub: "Forever", icon: <TrendingUp className="w-4 h-4" /> },
              { value: "0.15",      label: "SOL one-time fee",          sub: "Nothing else", icon: <Coins className="w-4 h-4" /> },
              { value: "60s",       label: "From click to live",        sub: "Avg. deploy", icon: <Clock className="w-4 h-4" /> },
              { value: "8%",        label: "Creator royalties",         sub: "100% yours", icon: <Sparkles className="w-4 h-4" /> },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className="card-gradient-border p-6 sm:p-8 animate-fade-up group hover:-translate-y-1 transition-transform duration-300"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="flex items-center gap-2 text-purple-300 mb-3">
                  {stat.icon}
                  <span className="text-[10px] uppercase tracking-widest font-bold">{stat.sub}</span>
                </div>
                <p className="gradient-text-solana font-extrabold text-5xl sm:text-6xl stat-number leading-none">
                  {stat.value}
                </p>
                <p className="text-zinc-400 text-sm mt-3 font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════════════════════
          HOW IT WORKS — 4 steps with connector line
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-4">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-purple-400">
              Four steps. Zero friction.
            </p>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              How it works
            </h2>
          </div>

          <div className="relative grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Connector line — desktop only */}
            <div
              aria-hidden
              className="hidden lg:block absolute top-12 left-[12.5%] right-[12.5%] h-px"
              style={{
                background: "linear-gradient(90deg, transparent 0%, rgba(153,69,255,0.4) 20%, rgba(20,241,149,0.3) 80%, transparent 100%)",
              }}
            />

            {HOW_IT_WORKS.map((step, i) => (
              <div
                key={i}
                className="card p-7 text-left space-y-4 relative group
                           hover:border-purple-500/40 hover:-translate-y-1.5
                           hover:shadow-[0_20px_48px_-12px_rgba(153,69,255,0.3)]
                           transition-all duration-300"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0
                               bg-purple-500/10 border border-purple-500/25
                               group-hover:bg-purple-500/20 group-hover:border-purple-500/50
                               group-hover:shadow-[0_0_20px_rgba(153,69,255,0.3)]
                               transition-all duration-300"
                  >
                    {step.icon}
                  </div>
                  <span
                    className="w-7 h-7 rounded-full text-[12px] font-extrabold
                               flex items-center justify-center shrink-0 text-white"
                    style={{
                      background: "linear-gradient(135deg, #9945FF, #14F195)",
                      boxShadow: "0 0 16px rgba(153,69,255,0.4)",
                    }}
                  >
                    {i + 1}
                  </span>
                </div>
                <h3 className="font-bold text-white text-base">{step.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════════════════════
          FEATURED COLLECTIONS — Grid with tilt hover
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-4">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-14 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-purple-400">
              Built with SolFactory
            </p>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              Collections going live
            </h2>
            <p className="text-zinc-500 text-base max-w-md mx-auto">
              Real collections. Real creators. 100% of sales go to them.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5">
            {FEATURED.map((c, i) => (
              <div
                key={c.name}
                className="animate-fade-up"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="tilt-card relative overflow-hidden rounded-2xl border border-white/8 bg-zinc-950
                                hover:border-purple-500/55
                                hover:shadow-[0_30px_60px_-12px_rgba(153,69,255,0.5)]
                                group">
                  <div className="relative w-full aspect-square overflow-hidden bg-zinc-900">
                    <img
                      src={c.imgSrc}
                      alt={c.imgAlt}
                      className="w-full h-full object-cover transition-all duration-700 ease-out
                                 group-hover:scale-110 group-hover:brightness-110"
                      loading="lazy"
                    />
                    {/* Colour grade overlay */}
                    <div aria-hidden className="absolute inset-0 pointer-events-none"
                         style={{ background: "rgba(20,5,40,0.25)", mixBlendMode: "multiply" }} />
                    {/* Bottom gradient */}
                    <div aria-hidden className="absolute inset-x-0 bottom-0 h-3/5 pointer-events-none"
                         style={{ background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 45%, transparent 100%)" }} />
                    {/* Spotlight on hover */}
                    <div aria-hidden
                         className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                         style={{ background: "radial-gradient(ellipse 90% 70% at 50% -10%, rgba(153,69,255,0.3) 0%, transparent 65%)" }} />
                    {/* Symbol badge */}
                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md
                                    border border-white/15 text-white text-[10px] font-bold tracking-widest uppercase">
                      {c.symbol}
                    </div>
                    {/* Supply badge */}
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg
                                    bg-violet-700/80 backdrop-blur-md border border-violet-400/30
                                    text-white text-[10px] font-semibold shadow-lg shadow-violet-900/30">
                      {c.supply} items
                    </div>
                    {/* Name overlay */}
                    <div className="absolute bottom-0 inset-x-0 px-3.5 pb-3.5 pt-8">
                      <p className="font-extrabold text-white text-sm leading-tight tracking-tight truncate">
                        {c.name}
                      </p>
                    </div>
                  </div>
                  <div className="px-3.5 py-3 flex items-center justify-between border-t border-white/5 bg-black/30 backdrop-blur-md">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-1.5 w-1.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                      </span>
                      <p className="text-[10px] text-zinc-400 font-semibold tracking-widest uppercase">
                        Minted on SolFactory
                      </p>
                    </div>
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-500/60 shrink-0" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center mt-12 text-sm text-zinc-500">
            Your collection could be here.{" "}
            <Link href="/create" className="text-purple-300 hover:text-purple-200 font-semibold underline-offset-2 hover:underline transition-colors">
              Launch yours →
            </Link>
          </p>
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════════════════════
          COMPARISON TABLE — SolFactory vs Others
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-4">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-14 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-purple-400">
              Why creators switch
            </p>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              SolFactory vs{" "}
              <span className="text-zinc-500">other launchpads</span>
            </h2>
          </div>

          <div className="card-gradient-border overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1.5fr_1fr_1fr] gap-4 px-6 sm:px-8 py-5 border-b border-white/10 bg-white/[0.02]">
              <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                Feature
              </div>
              <div className="flex items-center gap-2 text-sm font-extrabold">
                <span className="w-2 h-2 rounded-full bg-gradient-to-r from-purple-500 to-emerald-400 shadow-[0_0_10px_rgba(153,69,255,0.6)]" />
                <span className="gradient-text-solana">SolFactory</span>
              </div>
              <div className="text-sm font-bold text-zinc-500">Others</div>
            </div>

            {/* Rows */}
            {COMPARISON.map((row, i) => (
              <div
                key={row.label}
                className={`grid grid-cols-[1.5fr_1fr_1fr] gap-4 px-6 sm:px-8 py-5 text-sm
                            ${i !== COMPARISON.length - 1 ? "border-b border-white/5" : ""}
                            hover:bg-purple-500/[0.03] transition-colors duration-200`}
              >
                <div className="text-zinc-300 font-medium">{row.label}</div>
                <div className="flex items-center gap-2">
                  {row.sfOk
                    ? <Check className="w-4 h-4 text-emerald-400 shrink-0" strokeWidth={3} />
                    : <X className="w-4 h-4 text-red-400 shrink-0" strokeWidth={3} />
                  }
                  <span className="text-white font-semibold">{row.sf}</span>
                </div>
                <div className="flex items-center gap-2">
                  {row.othersOk
                    ? <Check className="w-4 h-4 text-emerald-400 shrink-0" strokeWidth={3} />
                    : <X className="w-4 h-4 text-red-500/70 shrink-0" strokeWidth={3} />
                  }
                  <span className="text-zinc-500">{row.others}</span>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center mt-8 text-xs text-zinc-500">
            No affiliation. Data based on publicly listed fees of major Solana NFT launchpads as of 2026.
          </p>
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════════════════════
          WHY CREATORS CHOOSE — Bento-ish feature grid
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-4">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-14 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-purple-400">
              Built for creators
            </p>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              Why creators choose SolFactory
            </h2>
            <p className="text-zinc-400 text-base max-w-xl mx-auto">
              Everything you need to launch — nothing you don&apos;t.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="card p-7 space-y-4 group relative overflow-hidden
                           hover:border-purple-500/45 hover:-translate-y-1.5
                           hover:shadow-[0_20px_48px_-12px_rgba(153,69,255,0.3)]
                           transition-all duration-300"
              >
                {/* Top accent line */}
                <div aria-hidden
                     className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/70 to-transparent
                                opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div className="w-12 h-12 rounded-xl flex items-center justify-center
                                bg-gradient-to-br from-purple-500/15 to-emerald-500/5
                                border border-purple-500/25
                                group-hover:border-purple-500/50
                                group-hover:shadow-[0_0_24px_rgba(153,69,255,0.3)]
                                transition-all duration-300">
                  {f.icon}
                </div>

                <h3 className="font-bold text-white text-base">{f.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════════════════════
          YOUR ROYALTIES
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-4">
        <div className="mx-auto max-w-3xl">
          <div
            className="card-gradient-border p-8 sm:p-10 space-y-7"
            style={{ boxShadow: "0 0 80px rgba(153,69,255,0.12)" }}
          >
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-purple-400">
                Your royalties
              </p>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                You keep <span className="gradient-text-solana">everything</span>
              </h2>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Zero platform fees encoded in the contract — nothing to trust, just read the code.
              </p>
            </div>

            <ul className="space-y-3.5">
              {ROYALTY_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm text-zinc-200">
                  <div className="shrink-0 mt-0.5 rounded-full p-0.5 shadow-[0_0_12px_rgba(20,241,149,0.4)]">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  {point}
                </li>
              ))}
            </ul>

            <div
              className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-5 py-4"
              style={{ boxShadow: "0 0 32px rgba(20,241,149,0.08)" }}
            >
              <p className="text-xs text-zinc-400 leading-relaxed">
                <span className="text-zinc-200 font-semibold block mb-1 text-sm">
                  Example calculation
                </span>
                With 8% royalties and 1,000 secondary sales at 1 SOL each →{" "}
                <span className="text-emerald-400 font-bold text-base">80 SOL earned passively</span>.
                SolFactory receives 0 SOL.
              </p>
            </div>
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════════════════════
          FAQ — Accordion
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-4">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-14 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-purple-400">
              Everything answered
            </p>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              Frequently asked
            </h2>
          </div>

          <div className="space-y-3">
            {FAQ.map((f, i) => (
              <details
                key={i}
                className="faq-item card group px-6 py-5 hover:border-purple-500/30 transition-colors duration-300"
              >
                <summary className="flex items-center justify-between gap-4 text-white font-semibold text-sm sm:text-base">
                  <span>{f.q}</span>
                  <ChevronDown className="faq-chevron w-4 h-4 text-purple-400 shrink-0" />
                </summary>
                <p className="mt-4 pt-4 border-t border-white/5 text-zinc-400 text-sm leading-relaxed">
                  {f.a}
                </p>
              </details>
            ))}
          </div>

          <p className="text-center mt-8 text-sm text-zinc-500">
            Other questions?{" "}
            <a href="https://x.com/solfactory_pro" target="_blank" rel="noopener noreferrer"
               className="text-purple-300 hover:text-purple-200 font-semibold underline-offset-2 hover:underline transition-colors">
              Ask us on X →
            </a>
          </p>
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════════════════════
          FINAL CTA — Premium banner
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-28 px-4">
        <div className="mx-auto max-w-4xl">
          <div
            className="card-gradient-border p-10 sm:p-16 text-center space-y-6 relative overflow-hidden"
          >
            {/* Radial accent */}
            <div
              aria-hidden
              className="absolute inset-0 -z-10 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse 60% 80% at 50% 0%, rgba(153,69,255,0.22) 0%, transparent 65%)",
              }}
            />

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full
                            border border-emerald-500/30 bg-emerald-500/10 text-emerald-300
                            text-xs font-bold tracking-widest uppercase mx-auto">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
              </span>
              Spots closing soon
            </div>

            <h2 className="text-3xl sm:text-5xl font-extrabold text-white leading-tight tracking-tight">
              Your collection,{" "}
              <span className="gradient-text-solana">on Solana</span>,
              <br />
              live in 60 seconds.
            </h2>
            <p className="text-zinc-400 max-w-lg mx-auto leading-relaxed text-base">
              Early creators get featured on the homepage. Featured collections receive{" "}
              <span className="text-purple-300 font-semibold">10× more visibility</span>.
            </p>

            <div className="flex flex-col items-center gap-3 pt-2">
              <Link href="/create" className="btn-primary text-base px-10 py-4">
                <Sparkles className="w-4 h-4" />
                Claim my spot — 0.15 SOL
                <ArrowRight className="w-4 h-4" />
              </Link>
              <p className="text-xs text-zinc-500">
                One-time fee · 0% commission · Your royalties, your rules
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
