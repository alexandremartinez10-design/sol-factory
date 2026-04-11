import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — SolFactory",
  description: "SolFactory terms of service and platform usage conditions.",
};

const SECTIONS = [
  {
    title: "1. Service Description",
    body: `SolFactory is a self-service NFT launchpad built on the Solana blockchain. It allows creators to deploy Metaplex Core NFT collections by paying a one-time fee of 0.15 SOL. The service provides collection initialization, image hosting via IPFS, metadata pinning, and a public mint page for each collection.`,
  },
  {
    title: "2. One-Time Fee",
    body: `Using SolFactory to deploy a collection requires a single payment of 0.15 SOL at the time of deployment. This fee covers infrastructure costs (IPFS pinning, on-chain transactions) and platform maintenance. There are no recurring fees, subscriptions, or hidden charges.`,
  },
  {
    title: "3. No Platform Commission",
    body: `SolFactory charges 0% commission on primary mint sales and 0% on secondary sales royalties. All SOL collected during minting goes directly and exclusively to the creator's wallet. This is enforced at the smart contract level and is verifiable on-chain — SolFactory has no technical ability to redirect these funds.`,
  },
  {
    title: "4. Creator Royalties",
    body: `Creators set their own royalty percentage at the time of collection creation. Royalties are encoded in the Metaplex Core NFT metadata and apply to secondary sales on compatible marketplaces. SolFactory does not receive any portion of royalties. Enforcement of royalties on secondary marketplaces depends on each marketplace's own policy and is outside of SolFactory's control.`,
  },
  {
    title: "5. Smart Contract Ownership",
    body: `The mpl-core collection and all associated NFTs minted through SolFactory are owned entirely by the creator's wallet. SolFactory holds no administrative authority over deployed collections after initialization. The on-chain program is publicly verifiable on Solana Explorer.`,
  },
  {
    title: "6. NFT Minting via Metaplex Core",
    body: `All collections deployed through SolFactory use the Metaplex Core protocol (mpl-core). NFTs conform to the Metaplex metadata standard and are compatible with all major Solana wallets and NFT marketplaces that support mpl-core assets.`,
  },
  {
    title: "7. Content Responsibility",
    body: `Creators are solely responsible for the content they upload, including images and metadata. By using SolFactory, you confirm that you own or have the rights to all uploaded content, and that it does not violate any applicable laws or third-party intellectual property rights. SolFactory reserves the right to remove featured collection listings that contain illegal or harmful content.`,
  },
  {
    title: "8. No Refunds",
    body: `The 0.15 SOL deployment fee is non-refundable once the on-chain transaction is confirmed. Blockchain transactions are irreversible by nature. If a deployment fails due to a technical error on our side, we will investigate and assist with a redeployment.`,
  },
  {
    title: "9. Risk Disclosure",
    body: `Blockchain-based services carry inherent risks including smart contract vulnerabilities, wallet key loss, network congestion, and market volatility. SolFactory is provided "as is" without warranties of any kind. Use of the platform is at your own risk. SolFactory is not liable for any loss of funds or assets.`,
  },
  {
    title: "10. Changes to Terms",
    body: `SolFactory may update these terms at any time. Continued use of the platform after updates constitutes acceptance of the revised terms. Material changes will be announced on our Twitter/X account (@solfactory_pro).`,
  },
];

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      {/* Header */}
      <div className="mb-12 space-y-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-4"
        >
          ← Back to home
        </Link>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
          Terms of Service
        </h1>
        <p className="text-zinc-500 text-sm">Last updated: April 2026</p>
        <p className="text-zinc-400 text-sm leading-relaxed pt-2">
          By using SolFactory you agree to these terms. They are intentionally short and written in plain language — no legal jargon.
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-8">
        {SECTIONS.map((s) => (
          <div key={s.title} className="card p-6 sm:p-7 space-y-3">
            <h2 className="font-bold text-white text-base">{s.title}</h2>
            <p className="text-zinc-400 text-sm leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>

      {/* Contact */}
      <div className="mt-10 rounded-2xl border border-purple-500/20 bg-purple-500/5 px-6 py-6 text-center space-y-2">
        <p className="text-sm text-zinc-300">
          Questions about these terms?
        </p>
        <a
          href="https://x.com/solfactory_pro"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-purple-400 hover:text-purple-300 transition-colors font-medium"
        >
          Contact us on Twitter / X →
        </a>
      </div>
    </div>
  );
}
