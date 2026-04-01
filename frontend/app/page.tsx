import Link from "next/link";
import { ImageIcon, DollarSign, Zap, Star } from "lucide-react";
import { AnimatedCounter } from "@/components/AnimatedCounter";

// ── Static data ───────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: <ImageIcon className="w-6 h-6 text-purple-400" />,
    title: "Upload your image",
    desc: "Drag in any JPG, PNG or GIF. We handle everything else automatically.",
  },
  {
    icon: <DollarSign className="w-6 h-6 text-purple-400" />,
    title: "Set your price",
    desc: "Choose how much each mint costs. Funds go directly to your wallet.",
  },
  {
    icon: <Zap className="w-6 h-6 text-purple-400" />,
    title: "Go live instantly",
    desc: "One click and your collection is on-chain, shareable, and open to buyers.",
  },
];

const TESTIMONIALS = [
  {
    name: "Alex Rivera",
    handle: "@alexcreates",
    quote:
      "I launched my first collection in under 3 minutes. It was live before my coffee was ready.",
    avatar: "https://ui-avatars.com/api/?name=Alex+Rivera&background=7c3aed&color=fff&size=64",
  },
  {
    name: "Sam Chen",
    handle: "@samchennft",
    quote:
      "I tried three other platforms. This is the only one where I didn't need a tutorial.",
    avatar: "https://ui-avatars.com/api/?name=Sam+Chen&background=6d28d9&color=fff&size=64",
  },
  {
    name: "Maya Osei",
    handle: "@mayaart",
    quote:
      "Sold out 200 pieces in a day. The simplicity is the whole point.",
    avatar: "https://ui-avatars.com/api/?name=Maya+Osei&background=a855f7&color=fff&size=64",
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center text-center px-4 pt-20 pb-32 overflow-hidden">
        {/* Background glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(124,58,237,0.18) 0%, transparent 70%)",
          }}
        />

        {/* Banner badge */}
        <div className="mb-8 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-sm font-medium">
          <Star className="w-3.5 h-3.5 fill-current" />
          Early creators get featured on the homepage
        </div>

        <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold text-white leading-[1.08] max-w-4xl mx-auto">
          Launch your NFT collection
          <br />
          <span className="gradient-text">in 60 seconds</span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-zinc-400 max-w-xl mx-auto leading-relaxed">
          No code. No setup. Just connect your wallet and go live instantly.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/create" className="btn-primary text-base px-8 py-4">
            Launch my collection (0.15 SOL)
          </Link>
          <Link href="/create?devnet=true" className="btn-ghost text-base px-8 py-4">
            Test on Devnet (free)
          </Link>
        </div>

        {/* Animated counter */}
        <div className="mt-10">
          <AnimatedCounter />
        </div>
      </section>

      {/* ── "Most tools are complicated" ──────────────────────────────────── */}
      <section className="py-24 px-4">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Most NFT tools are too complicated.
              <br />
              <span className="gradient-text">This one isn't.</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="card p-8 text-center space-y-4 hover:border-zinc-700 transition-all duration-300 hover:-translate-y-1"
              >
                <div className="inline-flex w-14 h-14 items-center justify-center rounded-2xl bg-purple-500/10 mx-auto">
                  {f.icon}
                </div>
                <h3 className="font-bold text-white text-lg">{f.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ──────────────────────────────────────────────────── */}
      <section className="py-24 px-4 bg-zinc-900/20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-white text-center mb-16">
            Creators love it
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="card p-6 space-y-4">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={t.avatar}
                    alt={t.name}
                    width={40}
                    height={40}
                    className="w-10 h-10 rounded-full"
                  />
                  <div>
                    <p className="font-semibold text-white text-sm">{t.name}</p>
                    <p className="text-xs text-zinc-500">{t.handle}</p>
                  </div>
                </div>
                <blockquote className="text-zinc-300 text-sm leading-relaxed">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ────────────────────────────────────────────────────── */}
      <section className="py-24 px-4">
        <div className="mx-auto max-w-3xl">
          <div className="card p-10 sm:p-14 text-center glow-purple space-y-6">
            <p className="text-4xl">🌟</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Early creators get featured on the homepage
            </h2>
            <p className="text-zinc-400 max-w-md mx-auto">
              Launch now while spots are still open. Featured collections get{" "}
              <span className="text-purple-300 font-semibold">10× more visibility</span>.
            </p>
            <Link href="/create" className="btn-primary text-base px-10 py-4 inline-flex">
              Claim my spot — 0.15 SOL
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
