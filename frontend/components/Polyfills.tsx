"use client";

// Importing polyfills.ts here ensures it is included in the client-side
// webpack bundle. layout.tsx is a server component so imports there only
// run on the server — this "use client" component is the right place.
import "../polyfills";

import { useEffect } from "react";
import { Buffer } from "buffer";

export function Polyfills() {
  useEffect(() => {
    // Re-apply after hydration as a belt-and-suspenders measure.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Buffer = Buffer;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).Buffer = Buffer;
  }, []);

  return null;
}
