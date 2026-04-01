"use client";

import { useSearchParams } from "next/navigation";

export function SimBanner() {
  const params = useSearchParams();
  const isSimMode =
    params.get("devnet") === "true" || params.get("simulated") === "true";

  if (!isSimMode) return null;

  return (
    <div className="w-full px-4 py-2.5 border-b border-yellow-500/25 bg-yellow-500/8 text-center">
      <p className="text-yellow-300 text-xs font-semibold tracking-wide">
        🧪 Simulation mode — no real transactions
      </p>
    </div>
  );
}
