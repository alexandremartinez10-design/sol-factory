import { type NextRequest, NextResponse } from "next/server";

// Force Node.js runtime — @irys/sdk uses native Node modules
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    // ── Parse multipart form data ─────────────────────────────────────────
    const formData = await request.formData();
    const imageFile = formData.get("image") as File | null;
    const name      = (formData.get("name")        as string | null) ?? "";
    const symbol    = (formData.get("symbol")      as string | null) ?? "";
    const description = (formData.get("description") as string | null) ?? "";

    if (!imageFile || !name) {
      return NextResponse.json(
        { error: "Missing required fields: image and name" },
        { status: 400 }
      );
    }

    // ── Validate file size (5 MB limit) ───────────────────────────────────
    const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
    if (imageFile.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Image is too large. Please use a file under 5 MB." },
        { status: 413 }
      );
    }

    // ── Validate file type ────────────────────────────────────────────────
    const VALID_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!VALID_TYPES.includes(imageFile.type)) {
      return NextResponse.json(
        { error: "Invalid image type. Use JPG, PNG, GIF, or WebP." },
        { status: 422 }
      );
    }

    // ── Check platform key (PRIVATE_KEY preferred; PLATFORM_PRIVATE_KEY legacy) ──
    const privateKey = process.env.PRIVATE_KEY ?? process.env.PLATFORM_PRIVATE_KEY;
    if (!privateKey) {
      console.error("PLATFORM_PRIVATE_KEY is not set");
      return NextResponse.json(
        { error: "Upload service is not configured." },
        { status: 500 }
      );
    }

    // ── Initialise Irys (dynamic import avoids edge-runtime conflicts) ────
    const { NodeIrys } = await import("@irys/sdk");

    const irys = new NodeIrys({
      network: "mainnet",
      token:   "solana",
      key:     privateKey,
      config: {
        providerUrl: process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.mainnet-beta.solana.com",
      },
    });

    await irys.ready();

    // ── Auto-fund if balance is too low (covers ~1 MB) ────────────────────
    const imageBuffer  = Buffer.from(await imageFile.arrayBuffer());
    const imageSize    = imageBuffer.byteLength;
    const metaEstimate = 512; // rough bytes for JSON metadata
    const needed       = await irys.getPrice(imageSize + metaEstimate);

    const balance = await irys.getLoadedBalance();
    if (balance.isLessThan(needed)) {
      await irys.fund(needed.minus(balance).multipliedBy(1.1).toFixed(0));
    }

    // ── Upload image ───────────────────────────────────────────────────────
    const imageReceipt = await irys.upload(imageBuffer, {
      tags: [
        { name: "Content-Type",  value: imageFile.type },
        { name: "App-Name",      value: "SolFactory" },
        { name: "Collection",    value: name },
      ],
    });
    const imageUrl = `https://gateway.irys.xyz/${imageReceipt.id}`;

    // ── Build and upload metadata ─────────────────────────────────────────
    const metadata = {
      name,
      symbol,
      description: description || `${name} NFT Collection created on SolFactory`,
      image:       imageUrl,
      attributes:  [],
      properties:  {
        files:    [{ uri: imageUrl, type: imageFile.type }],
        category: "image",
        creators: [],
      },
    };

    const metadataBuffer  = Buffer.from(JSON.stringify(metadata, null, 2));
    const metadataReceipt = await irys.upload(metadataBuffer, {
      tags: [
        { name: "Content-Type", value: "application/json" },
        { name: "App-Name",     value: "SolFactory" },
        { name: "Collection",   value: name },
      ],
    });
    const metadataUri = `https://gateway.irys.xyz/${metadataReceipt.id}`;

    return NextResponse.json({ imageUrl, metadataUri });
  } catch (err) {
    console.error("[api/upload] Error:", err);
    return NextResponse.json(
      {
        error:   "Upload failed",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
