import { type NextRequest, NextResponse } from "next/server";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { IDL } from "@/lib/idl";

// Inline constants to avoid importing lib/solana server-side.
// lib/solana creates a browser Connection at module level which fails on the server.
const PROGRAM_ID     = new PublicKey("133wgvX88vqPu8qYEVm18aWgTn1CVtYjcEUXvmnyeWWN");
const MPL_CORE_PROGRAM = new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");

export const runtime = "nodejs";

const connection = new Connection(
  process.env.HELIUS_RPC_URL ?? "https://api.mainnet-beta.solana.com",
  "confirmed"
);

/** Manually decode CollectionState fields needed for mint validation. */
function decodeState(data: Buffer): {
  name: string;
  supply: number;
  mintPrice: number;
  mintedCount: number;
  creator: PublicKey;
  collectionMint: PublicKey;
} | null {
  try {
    let offset = 8; // skip discriminator
    const nameLen   = data.readUInt32LE(offset); offset += 4;
    const name      = data.subarray(offset, offset + nameLen).toString("utf8"); offset += nameLen;
    const symLen    = data.readUInt32LE(offset); offset += 4 + symLen;
    const supply      = Number(data.readBigUInt64LE(offset)); offset += 8;
    const mintPriceLamp = Number(data.readBigUInt64LE(offset)); offset += 8;
    const mintedCount = Number(data.readBigUInt64LE(offset)); offset += 8;
    const creator        = new PublicKey(data.subarray(offset, offset + 32)); offset += 32;
    const collectionMint = new PublicKey(data.subarray(offset, offset + 32));
    return { name, supply, mintPrice: mintPriceLamp / LAMPORTS_PER_SOL, mintedCount, creator, collectionMint };
  } catch {
    return null;
  }
}

/**
 * POST /api/mint
 * Body: { collectionStatePda: string, buyerPubkey: string }
 *
 * Builds the mint_nft transaction and signs it with the fresh nftMint keypair.
 * The buyer is the only human signer — the program PDA co-signs on-chain
 * via invoke_signed (no creator signature needed).
 *
 * PRIVATE_KEY is NOT used here — it is only needed for Irys uploads.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      collectionStatePda?: string;
      buyerPubkey?: string;
    };

    const { collectionStatePda, buyerPubkey } = body;

    if (!collectionStatePda || !buyerPubkey) {
      return NextResponse.json(
        { error: "Missing required fields: collectionStatePda, buyerPubkey" },
        { status: 400 }
      );
    }

    // ── Fetch and decode CollectionState ─────────────────────────────────────
    const collectionStateKey = new PublicKey(collectionStatePda);
    const accountInfo = await connection.getAccountInfo(collectionStateKey);
    if (!accountInfo) {
      return NextResponse.json({ error: "Collection not found on-chain." }, { status: 404 });
    }

    const state = decodeState(Buffer.from(accountInfo.data));
    if (!state) {
      return NextResponse.json({ error: "Failed to decode collection state." }, { status: 500 });
    }

    if (state.mintedCount >= state.supply) {
      return NextResponse.json({ error: "This collection is fully minted." }, { status: 400 });
    }

    // ── Derive collection_authority PDA ────────────────────────────────────
    const [collectionAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("authority"), state.collectionMint.toBuffer()],
      PROGRAM_ID
    );

    // ── Generate fresh nftMint keypair ─────────────────────────────────────
    const nftMintKeypair = Keypair.generate();
    const buyer          = new PublicKey(buyerPubkey);

    // ── Build Anchor program with a read-only stub wallet ──────────────────
    // No real signing wallet needed here — the buyer signs client-side.
    const stubWallet = {
      publicKey:           buyer,
      signTransaction:     async (tx: Transaction) => tx,
      signAllTransactions: async (txs: Transaction[]) => txs,
    };

    const provider = new AnchorProvider(connection, stubWallet as never, {
      commitment:          "confirmed",
      preflightCommitment: "confirmed",
      skipPreflight:       true,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const program = new Program(IDL as any, provider) as any;

    // ── NFT metadata URI ──────────────────────────────────────────────────
    const nftNumber   = state.mintedCount + 1;
    const metadataUri = `https://ui-avatars.com/api/?name=${encodeURIComponent(
      `${state.name} #${nftNumber}`
    )}&background=7c3aed&color=fff&size=400`;

    // ── Build transaction ─────────────────────────────────────────────────
    const tx: Transaction = await program.methods
      .mintNft(metadataUri)
      .accounts({
        buyer,
        creator:             state.creator,
        collection:          state.collectionMint,
        nftMint:             nftMintKeypair.publicKey,
        collectionState:     collectionStateKey,
        collectionAuthority: collectionAuthority,
        mplCoreProgram:      MPL_CORE_PROGRAM,
        systemProgram:       SystemProgram.programId,
      })
      .transaction();

    // ── Set blockhash and fee payer ───────────────────────────────────────
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer        = buyer;

    // ── Sign with nftMint keypair only (buyer signs client-side) ──────────
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
    return NextResponse.json(
      {
        error:   "Mint preparation failed",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
