import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image       = formData.get("image") as File | null;
    const name        = (formData.get("name")        as string | null) ?? "";
    const symbol      = (formData.get("symbol")      as string | null) ?? "";
    const description = (formData.get("description") as string | null) ?? "";

    if (!image || !name) {
      return NextResponse.json(
        { error: "Missing required fields: image and name" },
        { status: 400 }
      );
    }

    // ── Validate file size (5 MB limit) ───────────────────────────────────
    const MAX_SIZE = 5 * 1024 * 1024;
    if (image.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Image is too large. Please use a file under 5 MB." },
        { status: 413 }
      );
    }

    // ── Validate file type ────────────────────────────────────────────────
    const VALID_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!VALID_TYPES.includes(image.type)) {
      return NextResponse.json(
        { error: "Invalid image type. Use JPG, PNG, GIF, or WebP." },
        { status: 422 }
      );
    }

    const pinataJWT = process.env.PINATA_JWT;
    if (!pinataJWT) {
      console.error("PINATA_JWT is not set");
      return NextResponse.json(
        { error: "Upload service is not configured." },
        { status: 500 }
      );
    }

    // ── Upload image to Pinata ────────────────────────────────────────────
    const imageForm = new FormData();
    imageForm.append("file", image);
    imageForm.append("pinataMetadata", JSON.stringify({ name: `${name}-image` }));

    const imageRes = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method:  "POST",
      headers: { Authorization: `Bearer ${pinataJWT}` },
      body:    imageForm,
    });

    if (!imageRes.ok) {
      const text = await imageRes.text();
      console.error("Pinata image upload failed:", imageRes.status, text);
      return NextResponse.json(
        { error: "Image upload failed", details: text },
        { status: 502 }
      );
    }

    const imageData = await imageRes.json() as { IpfsHash: string };
    const imageUrl  = `https://gateway.pinata.cloud/ipfs/${imageData.IpfsHash}`;

    // ── Upload metadata to Pinata ─────────────────────────────────────────
    const metadata = {
      name,
      symbol,
      description: description || `${name} NFT Collection created on SolFactory`,
      image:       imageUrl,
      attributes:  [],
      properties:  {
        files:    [{ uri: imageUrl, type: image.type }],
        category: "image",
        creators: [],
      },
    };

    const metaRes = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${pinataJWT}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pinataContent:  metadata,
        pinataMetadata: { name: `${name}-metadata` },
      }),
    });

    if (!metaRes.ok) {
      const text = await metaRes.text();
      console.error("Pinata metadata upload failed:", metaRes.status, text);
      return NextResponse.json(
        { error: "Metadata upload failed", details: text },
        { status: 502 }
      );
    }

    const metaData    = await metaRes.json() as { IpfsHash: string };
    const metadataUri = `https://gateway.pinata.cloud/ipfs/${metaData.IpfsHash}`;

    return NextResponse.json({ imageUrl, metadataUri });

  } catch (error: unknown) {
    const e = error as Error;
    console.error("Upload error:", e.message, e.stack);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
