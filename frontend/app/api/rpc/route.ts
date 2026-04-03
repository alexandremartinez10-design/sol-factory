import { type NextRequest, NextResponse } from "next/server";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.mainnet-beta.solana.com";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const res = await fetch(RPC_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const e = err as Error;
    console.error("[api/rpc] proxy error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
