import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const HELIUS_URL = process.env.HELIUS_RPC_URL;
  if (!HELIUS_URL) {
    return NextResponse.json({ error: "RPC not configured" }, { status: 500 });
  }

  try {
    const body = await request.json();

    const res = await fetch(HELIUS_URL, {
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
