/**
 * lib/solana.ts
 * All on-chain interactions for SolFactory.
 * Network: devnet  —  RPC: clusterApiUrl("devnet")
 */

import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  clusterApiUrl,
} from "@solana/web3.js";
import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import bs58 from "bs58";
import { IDL } from "./idl";

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

export const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

// ── Types ────────────────────────────────────────────────────────────────────

/** Minimal wallet interface accepted by AnchorProvider */
export interface AnchorWallet {
  publicKey: PublicKey;
  signTransaction(tx: Transaction): Promise<Transaction>;
  signAllTransactions(txs: Transaction[]): Promise<Transaction[]>;
}

/** Collection data returned by getCollections */
export interface CollectionInfo {
  /** Address of the CollectionState PDA */
  address: string;
  name: string;
  symbol: string;
  /** How many NFTs have been minted (starts at 1) */
  minted: number;
  supply: number;
  /** Mint price in SOL */
  mintPrice: number;
  /** Address of the mpl-core Collection asset */
  collectionMint: string;
  /** Internal: creator pubkey used for filtering — not exposed to callers */
  _creator?: PublicKey;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Derive the CollectionState PDA for a given creator + collection keypair. */
export function deriveCollectionState(
  creator: PublicKey,
  collection: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("collection"), creator.toBuffer(), collection.toBuffer()],
    PROGRAM_ID
  );
}

/** Derive the program authority PDA for a given collection mint.
 *  Seeds: ["authority", collection_mint]
 *  This PDA is the mpl-core update_authority, enabling serverless minting.
 */
export function deriveCollectionAuthority(
  collectionMint: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("authority"), collectionMint.toBuffer()],
    PROGRAM_ID
  );
}

/** Build an Anchor Program instance from a signer wallet. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeProgram(wallet: AnchorWallet): any {
  // Cast to any: @coral-xyz/anchor@0.30.1 uses a generic Wallet type that
  // doesn't match our simplified AnchorWallet, but the runtime shape is identical.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const provider = new AnchorProvider(connection, wallet as any, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  // Program ID is read from IDL.metadata.address in anchor 0.30.1.
  // Return as any to avoid excessively deep generic type instantiation.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Program(IDL as any, provider) as any;
}

/** Read-only wallet stub — use for getProgramAccounts, no signing. */
function readOnlyWallet(pubkey: PublicKey): AnchorWallet {
  return {
    publicKey: pubkey,
    signTransaction: async (tx) => tx,
    signAllTransactions: async (txs) => txs,
  };
}

// ── initializeCollection ─────────────────────────────────────────────────────

export interface InitCollectionParams {
  wallet: AnchorWallet;
  name: string;
  symbol: string;
  supply: number;
  mintPriceSol: number;
  /** Arweave / Irys metadata URI — caller is responsible for uploading first */
  metadataUri: string;
}

/**
 * Call the initialize_collection instruction on-chain.
 * Upload is handled separately by the caller before invoking this function.
 * Returns the CollectionState PDA address.
 */
export async function initializeCollection(
  params: InitCollectionParams
): Promise<string> {
  const { wallet, name, symbol, supply, mintPriceSol, metadataUri } = params;

  const collectionKeypair = Keypair.generate();
  const nftMintKeypair    = Keypair.generate();

  const [collectionStatePda]   = deriveCollectionState(wallet.publicKey, collectionKeypair.publicKey);
  const [collectionAuthority]  = deriveCollectionAuthority(collectionKeypair.publicKey);

  const program = makeProgram(wallet);

  await program.methods
    .initializeCollection(
      name,
      symbol,
      new BN(supply),
      new BN(Math.floor(mintPriceSol * LAMPORTS_PER_SOL)),
      metadataUri
    )
    .accounts({
      creator:             wallet.publicKey,
      platformWallet:      PLATFORM_WALLET,
      collection:          collectionKeypair.publicKey,
      nftMint:             nftMintKeypair.publicKey,
      collectionState:     collectionStatePda,
      collectionAuthority: collectionAuthority,
      mplCoreProgram:      MPL_CORE_PROGRAM,
      systemProgram:       SystemProgram.programId,
    })
    .signers([collectionKeypair, nftMintKeypair])
    .rpc();

  return collectionStatePda.toString();
}

// ── getCollections ────────────────────────────────────────────────────────────

/**
 * Anchor discriminator for CollectionState.
 * = sha256("account:CollectionState")[0..8]
 */
const COLLECTION_STATE_DISC = Buffer.from([228, 135, 148, 4, 244, 41, 118, 165]);

/**
 * Manually decode a CollectionState account from raw bytes.
 * Avoids Anchor IDL deserialization entirely (which has brittle type-name
 * requirements between IDL versions and causes "_bn" runtime errors).
 *
 * Layout (Borsh):
 *   [8]  discriminator
 *   [4+n] name  (String = u32LE length + UTF-8 bytes)
 *   [4+m] symbol
 *   [8]  supply       u64 LE
 *   [8]  mint_price   u64 LE
 *   [8]  minted_count u64 LE
 *   [32] creator      Pubkey
 *   [32] collection_mint Pubkey
 *   [1]  bump         u8
 */
function decodeCollectionState(
  pubkey: PublicKey,
  data: Buffer
): CollectionInfo | null {
  try {
    let offset = 8; // skip discriminator

    const nameLen = data.readUInt32LE(offset); offset += 4;
    const name    = data.subarray(offset, offset + nameLen).toString("utf8"); offset += nameLen;

    const symLen  = data.readUInt32LE(offset); offset += 4;
    const symbol  = data.subarray(offset, offset + symLen).toString("utf8");  offset += symLen;

    const supply      = Number(data.readBigUInt64LE(offset)); offset += 8;
    const mintPriceLamp = Number(data.readBigUInt64LE(offset)); offset += 8;
    const mintedCount = Number(data.readBigUInt64LE(offset)); offset += 8;

    const creator        = new PublicKey(data.subarray(offset, offset + 32)); offset += 32;
    const collectionMint = new PublicKey(data.subarray(offset, offset + 32));

    return {
      address:        pubkey.toString(),
      name,
      symbol,
      supply,
      mintPrice:      mintPriceLamp / LAMPORTS_PER_SOL,
      minted:         mintedCount,
      collectionMint: collectionMint.toString(),
      _creator:       creator,
    };
  } catch {
    return null; // malformed account — skip silently
  }
}

/**
 * Fetch all CollectionState PDAs owned by a given creator wallet.
 * Uses raw getProgramAccounts + manual Borsh decoding to avoid Anchor IDL
 * deserialization issues.
 */
export async function getCollections(
  walletPubkey: PublicKey
): Promise<CollectionInfo[]> {
  const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [
      // Match the 8-byte discriminator to only fetch CollectionState accounts
      // bytes is base58-encoded by default in @solana/web3.js getProgramAccounts
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

/**
 * Fetch and decode a single CollectionState PDA by its address.
 * Returns null if the account doesn't exist or is malformed.
 */
export async function getCollectionByAddress(
  pdaAddress: string
): Promise<CollectionInfo | null> {
  try {
    const pubkey      = new PublicKey(pdaAddress);
    const accountInfo = await connection.getAccountInfo(pubkey);
    if (!accountInfo) return null;
    const decoded = decodeCollectionState(pubkey, Buffer.from(accountInfo.data));
    if (!decoded) return null;
    const { _creator: _, ...info } = decoded;
    return info;
  } catch {
    return null;
  }
}

// ── sendDonation ──────────────────────────────────────────────────────────────

/**
 * Transfer `amountSol` SOL from `wallet` to the platform wallet.
 * Returns the transaction signature.
 */
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
    await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer        = wallet.publicKey;

  const signed = await wallet.signTransaction(tx);
  const sig    = await connection.sendRawTransaction(signed.serialize());

  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed"
  );

  return sig;
}

// ── checkBalance ─────────────────────────────────────────────────────────────

/** Returns true if the wallet has enough SOL to pay the platform fee + rent. */
export async function hasSufficientBalance(pubkey: PublicKey): Promise<boolean> {
  const balance = await connection.getBalance(pubkey);
  // 0.15 SOL fee + 0.01 SOL buffer for rent / tx fees
  return balance >= (PLATFORM_FEE_SOL + 0.01) * LAMPORTS_PER_SOL;
}
