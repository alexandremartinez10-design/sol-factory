"use client";

// This component runs before any Solana/Anchor code and ensures Buffer is
// available on window. The webpack ProvidePlugin injects Buffer inside module
// boundaries, but some code paths (especially @coral-xyz/anchor's borsh
// encoder) read from globalThis/window directly and fail if Buffer isn't there.
import { useEffect } from "react";
import { Buffer } from "buffer";

export function Polyfills() {
  // Also run synchronously at module eval time (covers SSR → hydration gap)
  if (typeof window !== "undefined") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(window as any).Buffer) (window as any).Buffer = Buffer;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(globalThis as any).Buffer) (globalThis as any).Buffer = Buffer;
  }

  useEffect(() => {
    // Belt-and-suspenders: re-apply after hydration in case anything cleared it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Buffer = Buffer;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).Buffer = Buffer;
  }, []);

  return null;
}
