import { type NextRequest, NextResponse } from "next/server";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  AccountMeta,
  ComputeBudgetProgram,
} from "@solana/web3.js";

export const runtime = "nodejs";

const PROGRAM_ID      = new PublicKey("133wgvX88vqPu8qYEVm18aWgTn1CVtYjcEUXvmnyeWWN");
const MPL_CORE        = new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");

// sha256("global:mint_nft")[0..8]
const DISC_MINT_NFT = Buffer.from([211, 57, 6, 167, 15, 219, 35, 251]);

const connection = new Connection(
  process.env.HELIUS_RPC_URL ?? "https://api.mainnet-beta.solana.com",
  "confirmed"
);

// ── Borsh helpers ─────────────────────────────────────────────────────────────

function encodeString(s: string): Buffer {
  const bytes = Buffer.from(s, "utf8");
  const len   = Buffer.allocUnsafe(4);
  len.writeUInt32LE(bytes.length, 0);
  return Buffer.concat([len, bytes]);
}

// ── Decode CollectionState ────────────────────────────────────────────────────

function decodeCollectionState(data: Buffer): {
  name: string;
  supply: number;
  mintPrice: number;
  mintedCount: number;
  creator: PublicKey;
  collectionMint: PublicKey;
  authorityBump: number;
} | null {
  try {
    let offset = 8; // skip discriminator
    const nameLen = data.readUInt32LE(offset); offset += 4;
    const name    = data.subarray(offset, offset + nameLen).toString("utf8"); offset += nameLen;
    const symLen  = data.readUInt32LE(offset); offset += 4 + symLen;
    const supply      = Number(data.readBigUInt64LE(offset)); offset += 8;
    const mintPriceLamp = Number(data.readBigUInt64LE(offset)); offset += 8;
    const mintedCount   = Number(data.readBigUInt64LE(offset)); offset += 8;
    const creator       = new PublicKey(data.subarray(offset, offset + 32)); offset += 32;
    const collectionMint = new PublicKey(data.subarray(offset, offset + 32)); offset += 32;
    offset += 1; // bump
    const authorityBump = data[offset];
    return { name, supply, mintPrice: mintPriceLamp / LAMPORTS_PER_SOL, mintedCount, creator, collectionMint, authorityBump };
  } catch {
    return null;
  }
}

// ── POST /api/mint ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { collectionStatePda?: string; buyerPubkey?: string };
    const { collectionStatePda, buyerPubkey } = body;

    if (!collectionStatePda || !buyerPubkey) {
      return NextResponse.json({ error: "Missing collectionStatePda or buyerPubkey" }, { status: 400 });
    }

    // Fetch and decode CollectionState
    const stateKey  = new PublicKey(collectionStatePda);
    const accountInfo = await connection.getAccountInfo(stateKey);
    if (!accountInfo) return NextResponse.json({ error: "Collection not found" }, { status: 404 });

    const state = decodeCollectionState(Buffer.from(accountInfo.data));
    if (!state)  return NextResponse.json({ error: "Failed to decode collection state" }, { status: 500 });

    if (state.mintedCount >= state.supply) {
      return NextResponse.json({ error: "Collection is fully minted" }, { status: 400 });
    }

    // Derive collection authority PDA
    const [collectionAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("authority"), state.collectionMint.toBuffer()],
      PROGRAM_ID
    );

    const nftMintKeypair = Keypair.generate();
    const buyer          = new PublicKey(buyerPubkey);
    const nftNumber      = state.mintedCount + 1;
    const uri            = `https://ui-avatars.com/api/?name=${encodeURIComponent(`${state.name} #${nftNumber}`)}&background=7c3aed&color=fff&size=400`;

    // Encode instruction data
    const data = Buffer.concat([DISC_MINT_NFT, encodeString(uri)]);

    const keys: AccountMeta[] = [
      { pubkey: buyer,                          isSigner: true,  isWritable: true  },
      { pubkey: state.creator,                  isSigner: false, isWritable: true  },
      { pubkey: state.collectionMint,           isSigner: false, isWritable: true  },
      { pubkey: nftMintKeypair.publicKey,       isSigner: true,  isWritable: true  },
      { pubkey: stateKey,                       isSigner: false, isWritable: true  },
      { pubkey: collectionAuthority,            isSigner: false, isWritable: false },
      { pubkey: MPL_CORE,                       isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId,        isSigner: false, isWritable: false },
    ];

    const instruction = new TransactionInstruction({ programId: PROGRAM_ID, keys, data });

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

    const tx = new Transaction();
    tx.recentBlockhash = blockhash;
    tx.feePayer        = buyer;
    tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5_000 }));
    tx.add(instruction);

    // Sign with nftMint keypair; buyer signs client-side
    tx.partialSign(nftMintKeypair);

    const serialized = tx.serialize({ requireAllSignatures: false });

    return NextResponse.json({
      transaction:         Buffer.from(serialized).toString("base64"),
      nftMint:             nftMintKeypair.publicKey.toString(),
      mintPrice:           state.mintPrice,
      nftNumber,
      blockhash,
      lastValidBlockHeight,
    });
  } catch (err) {
    console.error("[api/mint] Error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Mint failed" }, { status: 500 });
  }
}
