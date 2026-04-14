/**
 * lib/solana.ts
 * All on-chain interactions for SolFactory.
 * Uses raw @solana/web3.js — no @coral-xyz/anchor in the browser.
 */

import { Buffer } from "buffer";

import {
  AccountMeta,
  ComputeBudgetProgram,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";

// ── Constants ────────────────────────────────────────────────────────────────

export const PROGRAM_ID = new PublicKey(
  "133wgvX88vqPu8qYEVm18aWgTn1CVtYjcEUXvmnyeWWN"
);

export const MPL_CORE_PROGRAM = new PublicKey(
  "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
);

export const PLATFORM_WALLET = new PublicKey(
  "5dPJ1zx5Sx3KxUxdWLMivw6hV4DKUg5YUqcwSPXc5g4S"
);

export const PLATFORM_FEE_SOL = 0.15;

// Lazy singleton — created on first use (always browser-side).
// HTTP RPC → /api/rpc proxy (keeps Helius key server-side).
// WebSocket → Helius directly via NEXT_PUBLIC_HELIUS_WS_URL (proxying WS is not supported).
let _connection: Connection | undefined;
function getConnection(): Connection {
  if (!_connection) {
    const httpEndpoint = window.location.origin + "/api/rpc";
    const wsEndpoint   = process.env.NEXT_PUBLIC_HELIUS_WS_URL;
    // Only set wsEndpoint if explicitly configured — avoids auto-derived
    // wss://solfactory.pro/api/rpc which fails and spams reconnect retries.
    _connection = wsEndpoint
      ? new Connection(httpEndpoint, { commitment: "confirmed", wsEndpoint })
      : new Connection(httpEndpoint, "confirmed");
  }
  return _connection;
}

export { getConnection };

// ── Types ────────────────────────────────────────────────────────────────────

export interface AnchorWallet {
  publicKey: PublicKey;
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]>;
}

export interface CollectionInfo {
  address: string;
  name: string;
  symbol: string;
  minted: number;
  supply: number;
  mintPrice: number;
  collectionMint: string;
  publicMintEnabled: boolean;
  imageUrl?: string;
  _creator?: PublicKey;
}

// ── Instruction discriminators (sha256("global:<snake_case_name>")[0..8]) ────

// initializeCollection → sha256("global:initialize_collection")[0..8]
const DISC_INITIALIZE_COLLECTION = Buffer.from([112, 62, 53, 139, 173, 152, 98, 93]);

// togglePublicMint → sha256("global:toggle_public_mint")[0..8]
const DISC_TOGGLE_PUBLIC_MINT = Buffer.from([210, 17, 234, 26, 52, 149, 56, 96]);

// ── Borsh helpers ────────────────────────────────────────────────────────────

function encodeString(s: string): Buffer {
  const bytes = Buffer.from(s, "utf8");
  const len   = Buffer.allocUnsafe(4);
  len.writeUInt32LE(bytes.length, 0);
  return Buffer.concat([len, bytes]);
}

function encodeU64(n: number): Buffer {
  const buf = Buffer.allocUnsafe(8);
  buf.writeBigUInt64LE(BigInt(Math.floor(n)), 0);
  return buf;
}

function encodeBool(b: boolean): Buffer {
  return Buffer.from([b ? 1 : 0]);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function deriveCollectionState(
  creator: PublicKey,
  collection: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("collection"), creator.toBuffer(), collection.toBuffer()],
    PROGRAM_ID
  );
}

export function deriveCollectionAuthority(
  collectionMint: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("authority"), collectionMint.toBuffer()],
    PROGRAM_ID
  );
}

// ── initializeCollection ─────────────────────────────────────────────────────

export interface InitCollectionParams {
  wallet: AnchorWallet;
  name: string;
  symbol: string;
  supply: number;
  mintPriceSol: number;
  metadataUri: string;
}

export async function initializeCollection(
  params: InitCollectionParams
): Promise<{ address: string; collectionMint: string; signature: string }> {
  const { wallet, name, symbol, supply, mintPriceSol, metadataUri } = params;

  const collectionKeypair = Keypair.generate();
  const nftMintKeypair    = Keypair.generate();

  const [collectionStatePda] = deriveCollectionState(
    wallet.publicKey,
    collectionKeypair.publicKey
  );
  const [collectionAuthority] = deriveCollectionAuthority(
    collectionKeypair.publicKey
  );

  const mintPriceLamports = Math.floor(mintPriceSol * LAMPORTS_PER_SOL);

  console.log("=== PRE-TRANSACTION DEBUG ===");
  console.log("name:", name, typeof name);
  console.log("symbol:", symbol, typeof symbol);
  console.log("supply:", supply, typeof supply);
  console.log("mintPrice:", mintPriceSol, typeof mintPriceSol);
  console.log("metadataUri:", metadataUri, typeof metadataUri);
  console.log("wallet pubkey:", wallet.publicKey?.toString());
  console.log("collectionKeypair:", collectionKeypair.publicKey.toString());
  console.log("nftMintKeypair:", nftMintKeypair.publicKey.toString());
  console.log("collectionStatePda:", collectionStatePda.toString());
  console.log("collectionAuthority:", collectionAuthority.toString());
  console.log("============================");

  // Encode instruction data: discriminator + borsh args
  const data = Buffer.concat([
    DISC_INITIALIZE_COLLECTION,
    encodeString(name),
    encodeString(symbol),
    encodeU64(supply),
    encodeU64(mintPriceLamports),
    encodeString(metadataUri),
  ]);

  console.log("=== INSTRUCTION DATA DEBUG ===");
  console.log("metadataUri length :", metadataUri.length, "chars");
  console.log("metadataUri prefix :", metadataUri.substring(0, 60));
  console.log("instruction data   :", data.length, "bytes");
  console.log("==============================");

  const keys: AccountMeta[] = [
    { pubkey: wallet.publicKey,              isSigner: true,  isWritable: true  },
    { pubkey: PLATFORM_WALLET,               isSigner: false, isWritable: true  },
    { pubkey: collectionKeypair.publicKey,   isSigner: true,  isWritable: true  },
    { pubkey: nftMintKeypair.publicKey,      isSigner: true,  isWritable: true  },
    { pubkey: collectionStatePda,            isSigner: false, isWritable: true  },
    { pubkey: collectionAuthority,           isSigner: false, isWritable: false },
    { pubkey: MPL_CORE_PROGRAM,              isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId,       isSigner: false, isWritable: false },
  ];

  const instruction = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data,
  });

  // Fetch fresh blockhash immediately before signing.
  console.time("blockhash");
  const { blockhash, lastValidBlockHeight } =
    await getConnection().getLatestBlockhash("confirmed");
  console.timeEnd("blockhash");
  console.log("[initializeCollection] blockhash:", blockhash, "lastValid:", lastValidBlockHeight);

  // ── Step 1: Build VersionedTransaction — ZERO signatures ─────────────────
  // Blowfish (Phantom's security engine) flags any transaction that already
  // carries keypair signatures when it reaches signTransaction. We send a
  // completely clean transaction so Phantom is always the FIRST signer.
  const message = new TransactionMessage({
    payerKey:        wallet.publicKey,
    recentBlockhash: blockhash,
    instructions: [
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 250_000 }),
      instruction,
    ],
  }).compileToV0Message();   // addressTableLookups: [] by default

  const versionedTx = new VersionedTransaction(message);

  console.log("=== PRE-SIGN DEBUG ===");
  console.log("feePayer        :", wallet.publicKey.toString());
  console.log("recentBlockhash :", blockhash);
  console.log("collectionKeypair:", collectionKeypair.publicKey.toString(), "| secretKey:", collectionKeypair.secretKey.length, "bytes");
  console.log("nftMintKeypair  :", nftMintKeypair.publicKey.toString(),    "| secretKey:", nftMintKeypair.secretKey.length,    "bytes");
  console.log("staticAccountKeys:", message.staticAccountKeys.map((k, i) => `[${i}] ${k.toString()}`));
  console.log("signatures before Phantom:", versionedTx.signatures.map(s => s.every(b => b === 0) ? "empty" : "signed"));
  console.log("=====================");

  // ── Step 2: Phantom signs FIRST on a clean tx (required by Blowfish) ─────
  console.time("phantom-sign");
  console.log("[initializeCollection] Sending clean tx to Phantom...");
  const phantomResult = await wallet.signTransaction(versionedTx);
  console.timeEnd("phantom-sign");
  console.log("[initializeCollection] Phantom signed.");

  // ── Step 3: Keypairs sign AFTER Phantom ──────────────────────────────────
  // Use the appropriate method depending on whether Phantom returned a
  // VersionedTransaction or downgraded to a legacy Transaction.
  let serializedTx: Uint8Array;

  if (phantomResult instanceof VersionedTransaction) {
    console.log("[initializeCollection] Result is VersionedTransaction — calling .sign([keypairs])");
    phantomResult.sign([collectionKeypair, nftMintKeypair]);
    console.log("[initializeCollection] Final sig slots:", phantomResult.signatures.map((s, i) =>
      `[${i}] ${s.some(b => b !== 0) ? "SIGNED" : "empty"}`
    ));
    serializedTx = phantomResult.serialize();
  } else {
    // Phantom downgraded to legacy Transaction — use partialSign
    console.log("[initializeCollection] Result is legacy Transaction — calling .partialSign(keypairs)");
    const legacyTx = phantomResult as unknown as Transaction;
    legacyTx.partialSign(collectionKeypair, nftMintKeypair);
    console.log("[initializeCollection] Final sig slots:", legacyTx.signatures.map(s => ({
      pubkey: s.publicKey.toString().slice(0, 8) + "…",
      signed: s.signature !== null,
    })));
    serializedTx = legacyTx.serialize();
  }

  // ── Step 4: Send raw — skipPreflight avoids RPC simulation on multi-signer ─
  console.log("=== SEND DEBUG ===");
  console.log("serializedTx type  :", serializedTx.constructor?.name);
  console.log("serializedTx bytes :", serializedTx.length);
  console.log("base64 size (est.) :", Math.ceil(serializedTx.length / 3) * 4, "chars (limit ~1644)");
  console.log("==================");

  // Wrap in Buffer to guarantee proper base64 encoding by web3.js
  const txBuffer = Buffer.from(serializedTx);

  console.time("send-raw");
  const sig = await getConnection().sendRawTransaction(txBuffer, {
    skipPreflight:        true,
    preflightCommitment:  "confirmed",
    maxRetries:           3,
  });
  console.timeEnd("send-raw");
  console.log("[initializeCollection] Sent:", sig);
  console.log("[initializeCollection] Explorer: https://explorer.solana.com/tx/" + sig);

  // ── Step 5: Wait for confirmation ────────────────────────────────────────
  console.time("confirm");
  await getConnection().confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed"
  );
  console.timeEnd("confirm");
  console.log("[initializeCollection] Confirmed on-chain ✓");

  return {
    address:        collectionStatePda.toString(),
    collectionMint: collectionKeypair.publicKey.toString(),
    signature:      sig,
  };
}

// ── getCollections ────────────────────────────────────────────────────────────

const COLLECTION_STATE_DISC = Buffer.from([228, 135, 148, 4, 244, 41, 118, 165]);

// Read a u64 little-endian without relying on Buffer.readBigUInt64LE
// (which may not be available in all browser polyfill versions).
function readU64LE(data: Uint8Array, offset: number): number {
  const view = new DataView(data.buffer, data.byteOffset + offset, 8);
  const lo = view.getUint32(0, true);
  const hi = view.getUint32(4, true);
  return hi * 0x100000000 + lo;
}

function decodeCollectionState(
  pubkey: PublicKey,
  data: Uint8Array
): CollectionInfo | null {
  try {
    let offset = 8; // skip 8-byte Anchor discriminator

    // name: u32LE length + bytes
    const nameLen = new DataView(data.buffer, data.byteOffset + offset, 4).getUint32(0, true);
    offset += 4;
    const name = new TextDecoder().decode(data.subarray(offset, offset + nameLen));
    offset += nameLen;

    // symbol: u32LE length + bytes
    const symLen = new DataView(data.buffer, data.byteOffset + offset, 4).getUint32(0, true);
    offset += 4;
    const symbol = new TextDecoder().decode(data.subarray(offset, offset + symLen));
    offset += symLen;

    const supply        = readU64LE(data, offset); offset += 8;
    const mintPriceLamp = readU64LE(data, offset); offset += 8;
    const mintedCount   = readU64LE(data, offset); offset += 8;

    const creator        = new PublicKey(data.subarray(offset, offset + 32)); offset += 32;
    const collectionMint = new PublicKey(data.subarray(offset, offset + 32)); offset += 32;
    offset += 1; // bump
    offset += 1; // authority_bump
    const publicMintEnabled = offset < data.length ? data[offset] !== 0 : true;

    console.log("[decodeCollectionState] name:", name, "symbol:", symbol, "collectionMint:", collectionMint.toString());

    return {
      address:           pubkey.toString(),
      name,
      symbol,
      supply,
      mintPrice:         mintPriceLamp / LAMPORTS_PER_SOL,
      minted:            mintedCount,
      collectionMint:    collectionMint.toString(),
      publicMintEnabled,
      _creator:          creator,
    };
  } catch (e) {
    console.error("[decodeCollectionState] parse error:", e);
    return null;
  }
}

export async function getCollections(
  walletPubkey: PublicKey
): Promise<CollectionInfo[]> {
  const accounts = await getConnection().getProgramAccounts(PROGRAM_ID, {
    filters: [
      { memcmp: { offset: 0, bytes: bs58.encode(COLLECTION_STATE_DISC) } },
    ],
  });

  const decoded = accounts
    .map(({ pubkey, account }) => decodeCollectionState(pubkey, Buffer.from(account.data)))
    .filter((d): d is CollectionInfo => d !== null && d._creator!.equals(walletPubkey));

  // Fetch image URLs in parallel
  const results = await Promise.all(
    decoded.map(async ({ _creator: _, ...info }) => {
      info.imageUrl = await fetchCollectionImageUrl(info.collectionMint);
      return info;
    })
  );
  return results;
}

// ── fetchCollectionImageUrl ──────────────────────────────────────────────────
// Uses Helius DAS API (getAsset) to get the image URL for a mpl-core collection.
// No manual Borsh parsing — the RPC returns structured JSON metadata directly.

async function fetchCollectionImageUrl(collectionMint: string): Promise<string | undefined> {
  try {
    const rpcEndpoint = typeof window !== "undefined"
      ? window.location.origin + "/api/rpc"
      : "https://api.mainnet-beta.solana.com";

    const res = await fetch(rpcEndpoint, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        jsonrpc: "2.0",
        id:      1,
        method:  "getAsset",
        params:  { id: collectionMint },
      }),
    });

    const json = await res.json() as {
      result?: {
        content?: {
          links?: { image?: string };
          json_uri?: string;
        };
      };
    };

    console.log("[fetchCollectionImageUrl] getAsset result for", collectionMint, json.result?.content);

    // Try direct image link first (DAS fills this from metadata.image)
    const directImage = json.result?.content?.links?.image;
    if (directImage) return directImage;

    // Fallback: fetch the metadata JSON and extract image
    const jsonUri = json.result?.content?.json_uri;
    if (!jsonUri) return undefined;

    const metaRes = await fetch(jsonUri);
    if (!metaRes.ok) return undefined;
    const meta = await metaRes.json() as { image?: string };
    console.log("[fetchCollectionImageUrl] metadata.image:", meta.image);
    return meta.image ?? undefined;
  } catch (e) {
    console.error("[fetchCollectionImageUrl] error:", e);
    return undefined;
  }
}

// ── getCollectionByAddress ───────────────────────────────────────────────────

export async function getCollectionByAddress(
  pdaAddress: string
): Promise<CollectionInfo | null> {
  try {
    const pubkey      = new PublicKey(pdaAddress);
    const accountInfo = await getConnection().getAccountInfo(pubkey);
    if (!accountInfo) {
      console.warn("[getCollectionByAddress] No account at", pdaAddress);
      return null;
    }
    console.log("[getCollectionByAddress] account dataLen:", accountInfo.data.length, "owner:", accountInfo.owner.toString());
    const decoded = decodeCollectionState(pubkey, Buffer.from(accountInfo.data));
    if (!decoded) {
      console.warn("[getCollectionByAddress] Failed to decode CollectionState for", pdaAddress);
      return null;
    }
    const { _creator: _, ...info } = decoded;
    info.imageUrl = await fetchCollectionImageUrl(info.collectionMint);
    return info;
  } catch (e) {
    console.error("[getCollectionByAddress] error:", e);
    return null;
  }
}

// ── togglePublicMint ─────────────────────────────────────────────────────────

export async function togglePublicMint(
  wallet: AnchorWallet,
  collectionStatePda: string,
  collectionMint: string,
  enabled: boolean
): Promise<void> {
  const data = Buffer.concat([
    DISC_TOGGLE_PUBLIC_MINT,
    encodeBool(enabled),
  ]);

  const keys: AccountMeta[] = [
    { pubkey: wallet.publicKey,                   isSigner: true,  isWritable: true  },
    { pubkey: new PublicKey(collectionMint),       isSigner: false, isWritable: false },
    { pubkey: new PublicKey(collectionStatePda),   isSigner: false, isWritable: true  },
    { pubkey: SystemProgram.programId,             isSigner: false, isWritable: false },
  ];

  const instruction = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data,
  });

  const { blockhash, lastValidBlockHeight } =
    await getConnection().getLatestBlockhash();

  const tx = new Transaction();
  tx.recentBlockhash = blockhash;
  tx.feePayer        = wallet.publicKey;
  tx.add(instruction);

  const signed = await wallet.signTransaction(tx);
  const sig    = await getConnection().sendRawTransaction(signed.serialize());

  await getConnection().confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed"
  );
}

// ── sendDonation ──────────────────────────────────────────────────────────────

export async function sendDonation(
  wallet: AnchorWallet,
  amountSol: number
): Promise<string> {
  const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey:   PLATFORM_WALLET,
      lamports,
    })
  );

  const { blockhash, lastValidBlockHeight } =
    await getConnection().getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer        = wallet.publicKey;

  const signed = await wallet.signTransaction(tx);
  const sig    = await getConnection().sendRawTransaction(signed.serialize());

  await getConnection().confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed"
  );

  return sig;
}

// ── checkBalance ─────────────────────────────────────────────────────────────

export async function hasSufficientBalance(pubkey: PublicKey): Promise<boolean> {
  const balance = await getConnection().getBalance(pubkey);
  return balance >= (PLATFORM_FEE_SOL + 0.01) * LAMPORTS_PER_SOL;
}
