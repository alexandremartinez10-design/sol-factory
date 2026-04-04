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
    _connection = new Connection(
      httpEndpoint,
      wsEndpoint ? { commitment: "confirmed", wsEndpoint } : "confirmed"
    );
  }
  return _connection;
}

export { getConnection };

// ── Types ────────────────────────────────────────────────────────────────────

export interface AnchorWallet {
  publicKey: PublicKey;
  signTransaction(tx: Transaction): Promise<Transaction>;
  signAllTransactions(txs: Transaction[]): Promise<Transaction[]>;
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
): Promise<{ address: string; collectionMint: string }> {
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

  // Fetch blockhash as the very last step before building — caller must ensure
  // all slow async work (Pinata upload, etc.) is done before calling this function.
  const { blockhash, lastValidBlockHeight } =
    await getConnection().getLatestBlockhash("finalized");

  const tx = new Transaction();
  tx.recentBlockhash = blockhash;
  tx.feePayer        = wallet.publicKey;

  // Priority fee goes first to guarantee it's applied.
  tx.add(
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 })
  );
  tx.add(instruction);

  // partialSign with generated keypairs, then prompt wallet (fast — no more async after this).
  tx.partialSign(collectionKeypair, nftMintKeypair);
  const signed = await wallet.signTransaction(tx);

  console.log("Sending initializeCollection transaction...");
  const sig = await getConnection().sendRawTransaction(signed.serialize(), {
    skipPreflight: true,
  });
  console.log("Tx signature:", sig);

  await getConnection().confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed"
  );

  console.log("initializeCollection SUCCESS — PDA:", collectionStatePda.toString());

  return {
    address:        collectionStatePda.toString(),
    collectionMint: collectionKeypair.publicKey.toString(),
  };
}

// ── getCollections ────────────────────────────────────────────────────────────

const COLLECTION_STATE_DISC = Buffer.from([228, 135, 148, 4, 244, 41, 118, 165]);

function decodeCollectionState(
  pubkey: PublicKey,
  data: Buffer
): CollectionInfo | null {
  try {
    let offset = 8; // skip discriminator

    const nameLen = data.readUInt32LE(offset); offset += 4;
    const name    = data.subarray(offset, offset + nameLen).toString("utf8"); offset += nameLen;

    const symLen = data.readUInt32LE(offset); offset += 4;
    const symbol = data.subarray(offset, offset + symLen).toString("utf8");  offset += symLen;

    const supply        = Number(data.readBigUInt64LE(offset)); offset += 8;
    const mintPriceLamp = Number(data.readBigUInt64LE(offset)); offset += 8;
    const mintedCount   = Number(data.readBigUInt64LE(offset)); offset += 8;

    const creator        = new PublicKey(data.subarray(offset, offset + 32)); offset += 32;
    const collectionMint = new PublicKey(data.subarray(offset, offset + 32)); offset += 32;
    offset += 1; // bump
    offset += 1; // authority_bump
    const publicMintEnabled = offset < data.length ? data[offset] !== 0 : true;

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
  } catch {
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

  const results: CollectionInfo[] = [];
  for (const { pubkey, account } of accounts) {
    const decoded = decodeCollectionState(pubkey, Buffer.from(account.data));
    if (decoded && decoded._creator!.equals(walletPubkey)) {
      const { _creator: _, ...info } = decoded;
      results.push(info);
    }
  }
  return results;
}

// ── getCollectionByAddress ───────────────────────────────────────────────────

export async function getCollectionByAddress(
  pdaAddress: string
): Promise<CollectionInfo | null> {
  try {
    const pubkey      = new PublicKey(pdaAddress);
    const accountInfo = await getConnection().getAccountInfo(pubkey);
    if (!accountInfo) return null;
    const decoded = decodeCollectionState(pubkey, Buffer.from(accountInfo.data));
    if (!decoded) return null;
    const { _creator: _, ...info } = decoded;
    return info;
  } catch {
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
