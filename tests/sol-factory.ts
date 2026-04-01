import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import { expect } from "chai";
import { SolFactory } from "../target/types/sol_factory";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive the CollectionState PDA. */
function deriveCollectionState(
  programId: PublicKey,
  creator: PublicKey,
  collection: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("collection"), creator.toBuffer(), collection.toBuffer()],
    programId
  );
}

/** Airdrop SOL and wait for confirmation. */
async function airdrop(
  connection: anchor.web3.Connection,
  pubkey: PublicKey,
  sol: number
): Promise<void> {
  const sig = await connection.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL);
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });
}

// ---------------------------------------------------------------------------
// Constants — must match the values in lib.rs
// ---------------------------------------------------------------------------

/** Platform wallet address — matches PLATFORM_WALLET in lib.rs. */
const MPL_CORE_PROGRAM_ID = new PublicKey(
  "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
);

const PLATFORM_FEE_LAMPORTS = 150_000_000; // 0.15 SOL

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("sol_factory", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SolFactory as Program<SolFactory>;

  // ── Wallets ───────────────────────────────────────────────────────────────

  // Fixed platform wallet — must match the PLATFORM_WALLET constant in lib.rs.
  const platformWalletKeypair = { publicKey: new PublicKey("5dPJ1zx5Sx3KxUxdWLMivw6hV4DKUg5YUqcwSPXc5g4S") };
  const creatorKeypair        = Keypair.generate();
  const buyerKeypair          = Keypair.generate();

  // mpl-core asset accounts are plain keypairs — the program writes to them.
  const collectionKeypair     = Keypair.generate();
  const nftMint1Keypair       = Keypair.generate(); // NFT #1 (instant gratification)
  const nftMint2Keypair       = Keypair.generate(); // NFT #2 (public mint)

  let collectionStatePda: PublicKey;
  let collectionStateBump: number;

  // ── Setup ─────────────────────────────────────────────────────────────────

  before(async () => {
    const conn = provider.connection;

    // Fund wallets
    await Promise.all([
      airdrop(conn, creatorKeypair.publicKey, 5),
      airdrop(conn, buyerKeypair.publicKey,   3),
      // Platform wallet just needs to exist — no minimum balance required.
    ]);

    [collectionStatePda, collectionStateBump] = deriveCollectionState(
      program.programId,
      creatorKeypair.publicKey,
      collectionKeypair.publicKey
    );
  });

  // =========================================================================
  // initialize_collection
  // =========================================================================

  describe("initialize_collection", () => {
    const NAME       = "My Collection";
    const SYMBOL     = "MYCOL";
    const SUPPLY     = new BN(10);
    const MINT_PRICE = new BN(0.5 * LAMPORTS_PER_SOL); // 0.5 SOL
    const URI        = "https://arweave.net/collection-metadata.json";

    it("creates the collection, mints NFT #1, and transfers the platform fee", async () => {
      const creatorBalanceBefore   = await provider.connection.getBalance(creatorKeypair.publicKey);
      const platformBalanceBefore  = await provider.connection.getBalance(platformWalletKeypair.publicKey);

      await program.methods
        .initializeCollection(NAME, SYMBOL, SUPPLY, MINT_PRICE, URI)
        .accountsStrict({
          creator:         creatorKeypair.publicKey,
          platformWallet:  platformWalletKeypair.publicKey,
          collection:      collectionKeypair.publicKey,
          nftMint:         nftMint1Keypair.publicKey,
          collectionState: collectionStatePda,
          mplCoreProgram:  MPL_CORE_PROGRAM_ID,
          systemProgram:   SystemProgram.programId,
        })
        .signers([
          creatorKeypair,
          collectionKeypair,   // mpl-core requires the asset account to sign
          nftMint1Keypair,     // mpl-core requires the asset account to sign
        ])
        .rpc({ commitment: "confirmed" });

      // ── Assert CollectionState ─────────────────────────────────────────
      const state = await program.account.collectionState.fetch(collectionStatePda);

      expect(state.name).to.equal(NAME);
      expect(state.symbol).to.equal(SYMBOL);
      expect(state.supply.toNumber()).to.equal(SUPPLY.toNumber());
      expect(state.mintPrice.toNumber()).to.equal(MINT_PRICE.toNumber());
      expect(state.mintedCount.toNumber()).to.equal(1, "minted_count should be 1 after #1");
      expect(state.creator.toBase58()).to.equal(creatorKeypair.publicKey.toBase58());
      expect(state.collectionMint.toBase58()).to.equal(collectionKeypair.publicKey.toBase58());
      expect(state.bump).to.equal(collectionStateBump);

      // ── Assert platform fee transferred ───────────────────────────────
      const platformBalanceAfter = await provider.connection.getBalance(platformWalletKeypair.publicKey);
      expect(platformBalanceAfter - platformBalanceBefore).to.equal(
        PLATFORM_FEE_LAMPORTS,
        "platform wallet should have received 0.15 SOL"
      );

      // Creator balance decreased by at least the fee (plus rent + tx fees)
      const creatorBalanceAfter = await provider.connection.getBalance(creatorKeypair.publicKey);
      expect(creatorBalanceBefore - creatorBalanceAfter).to.be.gte(
        PLATFORM_FEE_LAMPORTS,
        "creator should have paid at least the platform fee"
      );
    });

    it("rejects an invalid platform wallet", async () => {
      const fakeWallet      = Keypair.generate();
      const fakeCollection  = Keypair.generate();
      const fakeNftMint     = Keypair.generate();

      await expect(
        program.methods
          .initializeCollection("X", "X", new BN(1), new BN(0), "https://x.com")
          .accountsStrict({
            creator:         creatorKeypair.publicKey,
            platformWallet:  fakeWallet.publicKey,   // ← wrong wallet
            collection:      fakeCollection.publicKey,
            nftMint:         fakeNftMint.publicKey,
            collectionState: deriveCollectionState(
              program.programId,
              creatorKeypair.publicKey,
              fakeCollection.publicKey
            )[0],
            mplCoreProgram:  MPL_CORE_PROGRAM_ID,
            systemProgram:   SystemProgram.programId,
          })
          .signers([creatorKeypair, fakeCollection, fakeNftMint])
          .rpc()
      ).to.be.rejectedWith(/InvalidPlatformWallet/);
    });

    it("rejects a name longer than 32 characters", async () => {
      const longNameCollection = Keypair.generate();
      const longNameNftMint    = Keypair.generate();

      await expect(
        program.methods
          .initializeCollection(
            "A".repeat(33),          // 33 chars — exceeds limit
            "SYM",
            new BN(5),
            new BN(0),
            "https://uri.com"
          )
          .accountsStrict({
            creator:         creatorKeypair.publicKey,
            platformWallet:  platformWalletKeypair.publicKey,
            collection:      longNameCollection.publicKey,
            nftMint:         longNameNftMint.publicKey,
            collectionState: deriveCollectionState(
              program.programId,
              creatorKeypair.publicKey,
              longNameCollection.publicKey
            )[0],
            mplCoreProgram:  MPL_CORE_PROGRAM_ID,
            systemProgram:   SystemProgram.programId,
          })
          .signers([creatorKeypair, longNameCollection, longNameNftMint])
          .rpc()
      ).to.be.rejectedWith(/NameTooLong/);
    });

    it("rejects supply = 0", async () => {
      const zeroSupplyCollection = Keypair.generate();
      const zeroSupplyNftMint    = Keypair.generate();

      await expect(
        program.methods
          .initializeCollection("Name", "SYM", new BN(0), new BN(0), "https://uri.com")
          .accountsStrict({
            creator:         creatorKeypair.publicKey,
            platformWallet:  platformWalletKeypair.publicKey,
            collection:      zeroSupplyCollection.publicKey,
            nftMint:         zeroSupplyNftMint.publicKey,
            collectionState: deriveCollectionState(
              program.programId,
              creatorKeypair.publicKey,
              zeroSupplyCollection.publicKey
            )[0],
            mplCoreProgram:  MPL_CORE_PROGRAM_ID,
            systemProgram:   SystemProgram.programId,
          })
          .signers([creatorKeypair, zeroSupplyCollection, zeroSupplyNftMint])
          .rpc()
      ).to.be.rejectedWith(/InvalidSupply/);
    });
  });

  // =========================================================================
  // mint_nft
  // =========================================================================

  describe("mint_nft", () => {
    const NFT_URI = "https://arweave.net/nft-2-metadata.json";

    it("mints NFT #2 to the buyer and increments minted_count", async () => {
      const buyerBalanceBefore   = await provider.connection.getBalance(buyerKeypair.publicKey);
      const creatorBalanceBefore = await provider.connection.getBalance(creatorKeypair.publicKey);

      const stateBefore = await program.account.collectionState.fetch(collectionStatePda);
      const mintPrice   = stateBefore.mintPrice.toNumber();

      await program.methods
        .mintNft(NFT_URI)
        .accountsStrict({
          buyer:           buyerKeypair.publicKey,
          creator:         creatorKeypair.publicKey,
          collection:      collectionKeypair.publicKey,
          nftMint:         nftMint2Keypair.publicKey,
          collectionState: collectionStatePda,
          mplCoreProgram:  MPL_CORE_PROGRAM_ID,
          systemProgram:   SystemProgram.programId,
        })
        .signers([
          buyerKeypair,    // pays mint price; authorises SOL transfer
          creatorKeypair,  // collection update_authority; authorises asset creation
          nftMint2Keypair, // new mpl-core asset account must sign
        ])
        .rpc({ commitment: "confirmed" });

      // ── Assert minted_count incremented ───────────────────────────────
      const stateAfter = await program.account.collectionState.fetch(collectionStatePda);
      expect(stateAfter.mintedCount.toNumber()).to.equal(
        stateBefore.mintedCount.toNumber() + 1,
        "minted_count should increment by 1"
      );

      // ── Assert mint price transferred from buyer to creator ───────────
      const buyerBalanceAfter   = await provider.connection.getBalance(buyerKeypair.publicKey);
      const creatorBalanceAfter = await provider.connection.getBalance(creatorKeypair.publicKey);

      expect(buyerBalanceBefore - buyerBalanceAfter).to.be.gte(
        mintPrice,
        "buyer should have paid at least the mint price"
      );
      expect(creatorBalanceAfter - creatorBalanceBefore).to.be.gte(
        mintPrice,
        "creator should have received the mint price"
      );
    });

    it("rejects mint when supply is exhausted", async () => {
      // Drain the remaining supply by minting until full
      const state = await program.account.collectionState.fetch(collectionStatePda);
      const remaining = state.supply.toNumber() - state.mintedCount.toNumber();

      for (let i = 0; i < remaining; i++) {
        const mintKeypair = Keypair.generate();
        await program.methods
          .mintNft(`https://arweave.net/nft-${i + 3}-metadata.json`)
          .accountsStrict({
            buyer:           buyerKeypair.publicKey,
            creator:         creatorKeypair.publicKey,
            collection:      collectionKeypair.publicKey,
            nftMint:         mintKeypair.publicKey,
            collectionState: collectionStatePda,
            mplCoreProgram:  MPL_CORE_PROGRAM_ID,
            systemProgram:   SystemProgram.programId,
          })
          .signers([buyerKeypair, creatorKeypair, mintKeypair])
          .rpc({ commitment: "confirmed" });
      }

      // Now supply is exhausted — next mint must fail
      const overflowMint = Keypair.generate();
      await expect(
        program.methods
          .mintNft("https://arweave.net/overflow.json")
          .accountsStrict({
            buyer:           buyerKeypair.publicKey,
            creator:         creatorKeypair.publicKey,
            collection:      collectionKeypair.publicKey,
            nftMint:         overflowMint.publicKey,
            collectionState: collectionStatePda,
            mplCoreProgram:  MPL_CORE_PROGRAM_ID,
            systemProgram:   SystemProgram.programId,
          })
          .signers([buyerKeypair, creatorKeypair, overflowMint])
          .rpc()
      ).to.be.rejectedWith(/CollectionFullyMinted/);
    });
  });
});
