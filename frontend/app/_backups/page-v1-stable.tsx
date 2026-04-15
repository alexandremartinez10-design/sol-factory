// app/page.tsx — SolFactory homepage (redesign premium v2)

import Link from "next/link";
import {
  Wallet, Upload, SlidersHorizontal, Zap, Star,
  DollarSign, TrendingUp, Lock, Cloud, Shield, Rocket,
  CheckCircle2,
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
    desc: "Set mint price and supply. 8% royalties are applied automatically on secondary sales. Funds go directly to your wallet.",
  },
  {
    icon: <Zap className="w-5 h-5 text-purple-300" />,
    title: "Go Live in One Click",
    desc: "Deploy on Solana Mainnet. Get your mint link instantly.",
  },
];

// ── Why SolFactory feature cards ──────────────────────────────────────────────

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
    desc: "The smart contract is 100% yours. Fully verifiable on Solana Explorer.",
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

// ── Royalties breakdown ───────────────────────────────────────────────────────

const ROYALTY_POINTS = [
  "With 8% royalties, you earn on every secondary sale — forever",
  "SolFactory takes 0% ongoing commission. Ever.",
  "Royalties are encoded in the smart contract and fully on-chain",
];

// ── Featured collections (marketing examples — not real user collections) ─────
// TODO: Remplacer chaque imgSrc par l'URL IPFS d'une vraie image NFT premium
// Style recommandé : dark cyberpunk, generative art, abstract, PFP, futuristic

const FEATURED = [
  {
    name: "Lunar Eclipse",
    symbol: "LUNA",
    supply: "500",
    imgSrc: "/lunar-eclipse.png.jpg",
    imgAlt: "Lunar Eclipse NFT — holographic VIP festival badge collection on Solana",
  },
  {
    name: "Arcane Circle",
    symbol: "ARCN",
    supply: "200",
    imgSrc: "/arcane-circle.png.jpg",
    imgAlt: "Arcane Circle NFT — founding member key collection on Solana",
  },
  {
    name: "Crystal Spirit",
    symbol: "CRYS",
    supply: "300",
    imgSrc: "/crystal-spirit.png.jpg",
    imgAlt: "Crystal Spirit NFT — crystal fox spirit collection on Solana",
  },
  {
    name: "Neon Phantom",
    symbol: "NPHM",
    supply: "500",
    imgSrc: "/neon-phantom.png.jpg",
    imgAlt: "Neon Phantom NFT — cyberpunk neon silhouette collection on Solana",
  },
  {
    name: "Aurora Wolves",
    symbol: "AWLF",
    supply: "200",
    imgSrc: "/aurora-wolves.png.jpg",
    imgAlt: "Aurora Wolves NFT — ethereal wolves aurora borealis collection on Solana",
  },
  {
    name: "Legendary Skin Pass",
    symbol: "LGND",
    supply: "100",
    imgSrc: "/legendary-skin-pass.png.jpg",
    imgAlt: "Legendary Skin Pass NFT — exclusive cyberpunk warrior skin collection on Solana",
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <>
      {/* ══════════════════════════════════════════════════════════════════════
          HERO — gradient multicouche pour plus de profondeur et d'impact
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="relative flex flex-col items-center justify-center text-center px-4 pt-28 pb-40 overflow-hidden">

        {/* Glow principal — violet large */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 100% 60% at 50% -10%, rgba(124,58,237,0.30) 0%, transparent 65%)",
          }}
        />
        {/* Glow secondaire — rose/violet plus chaud pour plus de relief */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 55% 40% at 50% 0%, rgba(168,85,247,0.18) 0%, transparent 55%)",
          }}
        />
        {/* Vignette basse pour fondre le contenu dans le fond */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40 -z-10"
          style={{
            background: "linear-gradient(to top, #0a0a0a 0%, transparent 100%)",
          }}
        />

        {/* Badge "early access" */}
        <div
          className="mb-8 inline-flex items-center gap-2 px-4 py-2 rounded-full
                     border border-purple-500/35 bg-purple-500/12 text-purple-300
                     text-sm font-medium animate-fade-up
                     shadow-[0_0_20px_rgba(124,58,237,0.12)]"
          style={{ animationDelay: "0ms" }}
        >
          <Star className="w-3.5 h-3.5 fill-current" />
          Early access — be one of the first creators
        </div>

        {/* H1 — plus grand, tracking plus serré, gradient amélioré */}
        <h1
          className="animate-fade-up text-5xl sm:text-6xl md:text-7xl font-extrabold text-white leading-[1.06] max-w-4xl mx-auto tracking-tight"
          style={{ animationDelay: "80ms" }}
        >
          Launch Your Solana NFT
          <br />
          Collection in{" "}
          {/* Gradient plus vibrant : violet → rose clair */}
          <span
            className="gradient-text"
            style={{
              background: "linear-gradient(135deg, #c084fc 0%, #a78bfa 40%, #818cf8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            60 Seconds
          </span>
        </h1>

        {/* Subtitle */}
        <p
          className="animate-fade-up mt-7 text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed"
          style={{ animationDelay: "160ms" }}
        >
          No code. No setup. No complicated tools. Just connect your wallet,
          upload your art, and go live on Mainnet instantly.
        </p>

        {/* Trust badges inline */}
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
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full
                         border border-emerald-500/30 bg-emerald-500/8 text-emerald-300
                         text-xs font-semibold"
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
            className="btn-primary text-base px-10 py-4 shadow-xl shadow-purple-900/35"
          >
            Launch My Collection Now
          </Link>
          <Link
            href="/create?devnet=true"
            className="btn-ghost text-base px-10 py-4"
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


      {/* ══════════════════════════════════════════════════════════════════════
          FEATURED COLLECTIONS — section la plus impactante visuellement
          Cartes premium : hover glow violet, zoom image, badges glass
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-4 animate-fade-up" style={{ animationDelay: "100ms" }}>
        <div className="mx-auto max-w-6xl">

          {/* Section header amélioré */}
          <div className="text-center mb-14 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-purple-400">
              Built with SolFactory
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Collections on SolFactory
            </h2>
            <p className="text-zinc-500 text-sm max-w-sm mx-auto">
              Launch yours in 60 seconds. No code required.
            </p>
          </div>

          {/* Grid cartes */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5">
            {FEATURED.map((c, i) => (
              // Carte non-cliquable — cursor-default
              // Délai de fade-up progressif pour un rendu en cascade élégant
              <div
                key={c.name}
                className="animate-fade-up"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div
                  className="
                    relative overflow-hidden rounded-2xl
                    border border-zinc-800/90 bg-zinc-950
                    group cursor-default
                    transition-all duration-500 ease-out
                    hover:-translate-y-2.5
                    hover:border-purple-500/55
                    hover:shadow-2xl hover:shadow-purple-900/35
                  "
                >
                  {/* ── Image NFT ─────────────────────────────────────────── */}
                  {/* TODO: Remplacer imgSrc par l'URL IPFS d'une vraie image NFT */}
                  <div className="relative w-full aspect-square overflow-hidden bg-zinc-900">
                    <img
                      src={c.imgSrc}
                      alt={c.imgAlt}
                      // Zoom + légère surexposition au hover pour effet premium
                      className="w-full h-full object-cover
                                 transition-all duration-700 ease-out
                                 group-hover:scale-110 group-hover:brightness-110"
                      loading="lazy"
                    />

                    {/* Color-grade overlay — assombrit et violet-ise les images
                        → n'importe quelle photo ressemble plus à du dark NFT art */}
                    <div
                      aria-hidden
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: "rgba(20, 5, 40, 0.28)",
                        mixBlendMode: "multiply",
                      }}
                    />

                    {/* Gradient de lecture en bas — fort pour le nom */}
                    <div
                      aria-hidden
                      className="absolute inset-x-0 bottom-0 h-3/5 pointer-events-none"
                      style={{
                        background:
                          "linear-gradient(to top, rgba(0,0,0,0.97) 0%, rgba(0,0,0,0.55) 45%, transparent 100%)",
                      }}
                    />

                    {/* Glow violet depuis le haut au hover — effet "spotlight" */}
                    <div
                      aria-hidden
                      className="absolute inset-0 pointer-events-none
                                 opacity-0 group-hover:opacity-100
                                 transition-opacity duration-500"
                      style={{
                        background:
                          "radial-gradient(ellipse 90% 70% at 50% -10%, rgba(139,92,246,0.22) 0%, transparent 65%)",
                      }}
                    />

                    {/* Badge SYMBOL — verre dépoli top-right */}
                    <div
                      className="absolute top-3 right-3
                                 px-2.5 py-1 rounded-lg
                                 bg-black/55 backdrop-blur-md
                                 border border-white/12
                                 text-white text-[10px] font-bold tracking-widest uppercase
                                 shadow-sm"
                    >
                      {c.symbol}
                    </div>

                    {/* Badge SUPPLY — violet accent top-left */}
                    <div
                      className="absolute top-3 left-3
                                 px-2.5 py-1 rounded-lg
                                 bg-violet-700/75 backdrop-blur-md
                                 border border-violet-400/25
                                 text-white text-[10px] font-semibold
                                 shadow-sm shadow-violet-900/30"
                    >
                      {c.supply} items
                    </div>

                    {/* Nom collection — overlay bas, typo premium */}
                    <div className="absolute bottom-0 inset-x-0 px-3.5 pb-3.5 pt-8">
                      <p
                        className="font-extrabold text-white text-sm leading-tight
                                   tracking-tight truncate
                                   drop-shadow-[0_1px_8px_rgba(0,0,0,0.8)]"
                      >
                        {c.name}
                      </p>
                    </div>
                  </div>

                  {/* ── Footer carte — badge "Minted on SolFactory" ────────── */}
                  {/* Design premium : dot pulsant + icône vérification */}
                  <div
                    className="px-3.5 py-3 flex items-center justify-between
                               border-t border-zinc-800/70 bg-zinc-950"
                  >
                    <div className="flex items-center gap-2">
                      {/* Dot violet animé — indique "live / verified" */}
                      <span className="relative flex h-1.5 w-1.5 shrink-0">
                        <span
                          className="animate-ping absolute inline-flex h-full w-full
                                     rounded-full bg-purple-400 opacity-60"
                        />
                        <span
                          className="relative inline-flex rounded-full h-1.5 w-1.5
                                     bg-purple-500"
                        />
                      </span>
                      <p className="text-[10px] text-zinc-500 font-semibold tracking-widest uppercase">
                        Minted on SolFactory
                      </p>
                    </div>
                    {/* Icône vérification — renforce le côté premium/officiel */}
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-500/50 shrink-0" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* CTA sous la grille */}
          <p className="text-center mt-12 text-sm text-zinc-500">
            Your collection could be here.{" "}
            <Link
              href="/create"
              className="text-purple-400 hover:text-purple-300 font-semibold
                         transition-colors underline-offset-2 hover:underline"
            >
              Launch yours →
            </Link>
          </p>
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════════════════════
          VALUE BANNER — gradient violet amélioré, texte plus impactant
      ══════════════════════════════════════════════════════════════════════ */}
      <div
        className="relative w-full py-9 overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #6d28d9 0%, #7c3aed 50%, #a855f7 100%)",
        }}
      >
        {/* Reflet brillant centré */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 55% 200% at 50% 50%, rgba(255,255,255,0.12) 0%, transparent 65%)",
          }}
        />
        <p
          className="relative text-center text-white font-bold text-xl sm:text-2xl px-6 tracking-tight"
          style={{ textShadow: "0 2px 24px rgba(109,40,217,0.6)" }}
        >
          🔒 Pay 0.15 SOL once. Keep 100% of your royalties. Forever.
        </p>
      </div>


      {/* ══════════════════════════════════════════════════════════════════════
          HOW IT WORKS — numéros de step plus premium, hover avec left-border glow
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-28 px-4">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              How it works
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {HOW_IT_WORKS.map((step, i) => (
              <div
                key={i}
                className="
                  card p-7 text-left space-y-4
                  hover:border-purple-500/45 hover:-translate-y-1.5
                  hover:shadow-lg hover:shadow-purple-900/20
                  transition-all duration-300
                  group
                "
              >
                {/* Step indicator : numéro + icône */}
                <div className="flex items-center gap-3">
                  {/* Icône dans un carré avec fond gradient subtil */}
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0
                               bg-purple-500/12 border border-purple-500/20
                               group-hover:bg-purple-500/20 group-hover:border-purple-500/40
                               transition-all duration-300"
                  >
                    {step.icon}
                  </div>
                  {/* Numéro de step — badge rounded avec gradient */}
                  <span
                    className="w-6 h-6 rounded-full text-[11px] font-extrabold
                               flex items-center justify-center shrink-0 text-white"
                    style={{
                      background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                      boxShadow: "0 0 10px rgba(124,58,237,0.4)",
                    }}
                  >
                    {i + 1}
                  </span>
                </div>

                <h3 className="font-bold text-white text-sm">{step.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-purple-300 font-medium mt-10">
            ⚡ Most creators launch in under 60 seconds
          </p>
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════════════════════
          WHY SOLFACTORY — icônes avec glow au hover, gradient top-border subtil
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-28 px-4">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16 space-y-3">
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Why Creators Choose SolFactory
            </h2>
            <p className="text-zinc-400 text-base max-w-xl mx-auto">
              Everything you need to launch — nothing you don&apos;t.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="
                  card p-7 space-y-4 group
                  hover:border-purple-500/45 hover:-translate-y-1.5
                  hover:shadow-lg hover:shadow-purple-900/20
                  transition-all duration-300
                  relative overflow-hidden
                "
              >
                {/* Ligne de surbrillance top au hover — effet "glow border" */}
                <div
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-px
                             bg-gradient-to-r from-transparent via-purple-500/60 to-transparent
                             opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                />

                {/* Icône — fond s'illumine au hover */}
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center
                             bg-purple-500/12 border border-purple-500/20
                             group-hover:bg-purple-500/22 group-hover:border-purple-500/45
                             group-hover:shadow-[0_0_16px_rgba(124,58,237,0.25)]
                             transition-all duration-300"
                >
                  {f.icon}
                </div>

                <h3 className="font-bold text-white text-sm">{f.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border border-zinc-700/60 bg-zinc-900/50 px-7 py-5 max-w-lg mx-auto text-center">
            <p className="text-sm text-zinc-400 leading-relaxed">
              <span className="text-zinc-200 font-semibold">
                This isn&apos;t a promise. It&apos;s written in the smart contract.
              </span>{" "}
              Anyone can verify it on-chain.
            </p>
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════════════════════
          ROYALTIES — exemple en box emerald bien mis en valeur,
          points de liste avec glow subtil sur les icônes
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-4">
        <div className="mx-auto max-w-3xl">
          <div
            className="card p-8 sm:p-10 space-y-7"
            style={{
              borderColor: "rgba(124,58,237,0.28)",
              boxShadow: "0 0 48px rgba(124,58,237,0.08), inset 0 0 40px rgba(124,58,237,0.03)",
            }}
          >
            {/* Header section */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-purple-400">
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

            {/* Points liste — icônes CheckCircle avec glow */}
            <ul className="space-y-3.5">
              {ROYALTY_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm text-zinc-300">
                  {/* Icône avec halo vert subtil */}
                  <div className="shrink-0 mt-0.5 rounded-full p-0.5
                                  shadow-[0_0_8px_rgba(52,211,153,0.35)]">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  {point}
                </li>
              ))}
            </ul>

            {/* Exemple chiffré — box emerald mise en valeur */}
            <div
              className="rounded-xl border border-emerald-500/25 bg-emerald-500/6 px-5 py-4"
              style={{ boxShadow: "0 0 24px rgba(52,211,153,0.06)" }}
            >
              <p className="text-xs text-zinc-400 leading-relaxed">
                <span className="text-zinc-200 font-semibold block mb-1 text-sm">
                  Example calculation
                </span>
                With 8% royalties and 1,000 secondary sales at 1 SOL each →{" "}
                <span className="text-emerald-400 font-bold text-sm">
                  80 SOL earned passively
                </span>
                . SolFactory receives 0 SOL.
              </p>
            </div>
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════════════════════
          NOTE DE L'ÉQUIPE — inchangé visuellement, légèrement renforcé
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-16 px-4">
        <div className="mx-auto max-w-2xl">
          <div
            className="rounded-2xl border border-purple-500/22 bg-purple-500/5
                       px-8 py-8 text-center space-y-3"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-purple-400">
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


      {/* ══════════════════════════════════════════════════════════════════════
          CTA BANNER FINAL — glow plus fort, typographie plus impactante
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-28 px-4">
        <div className="mx-auto max-w-3xl">
          <div
            className="card p-10 sm:p-16 text-center space-y-6"
            style={{
              boxShadow:
                "0 0 60px rgba(124,58,237,0.15), 0 0 120px rgba(168,85,247,0.07), inset 0 0 60px rgba(124,58,237,0.04)",
              borderColor: "rgba(124,58,237,0.30)",
            }}
          >
            <p className="text-4xl">🌟</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white leading-tight tracking-tight">
              Early creators get featured
              <br />
              on the homepage
            </h2>
            <p className="text-zinc-400 max-w-md mx-auto leading-relaxed">
              Launch now while spots are still open. Featured collections get{" "}
              <span className="text-purple-300 font-semibold">10× more visibility</span>.
            </p>
            <div className="flex flex-col items-center gap-3">
              <Link
                href="/create"
                className="btn-primary text-base px-10 py-4 inline-flex
                           shadow-xl shadow-purple-900/35"
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
