export async function POST(request: Request) {
  const heliusUrl = process.env.HELIUS_RPC_URL;

  if (!heliusUrl) {
    return Response.json({ error: "RPC not configured" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const response = await fetch(heliusUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();

    // Log RPC errors to help debug (server-side — visible in Vercel function logs)
    if (data?.error) {
      console.error("[rpc-proxy] RPC error for method", body?.method, ":", JSON.stringify(data.error));
    }

    return Response.json(data);
  } catch (error: unknown) {
    const e = error as Error;
    return Response.json({ error: e.message }, { status: 500 });
  }
}
