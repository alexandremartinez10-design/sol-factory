"use client";

import { useEffect, useState } from "react";

function random(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function AnimatedCounter() {
  const [count, setCount] = useState<number | null>(null);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    setCount(random(12, 47));
    const id = setInterval(() => {
      setAnimating(true);
      setTimeout(() => {
        setCount(random(12, 47));
        setAnimating(false);
      }, 250);
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-zinc-700/60 bg-zinc-900/50 text-sm text-zinc-400">
      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      Collections launched today:&nbsp;
      <span
        className={`font-bold text-white tabular-nums transition-all duration-200 ${
          animating ? "opacity-0 -translate-y-1" : "opacity-100 translate-y-0"
        }`}
      >
        {count ?? "—"}
      </span>
    </div>
  );
}
