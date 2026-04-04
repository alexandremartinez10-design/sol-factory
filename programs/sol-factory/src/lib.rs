use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use mpl_core::{
    instructions::{CreateCollectionV1CpiBuilder, CreateV1CpiBuilder},
    types::{Creator, Plugin, PluginAuthorityPair, Royalties, RuleSet},
};

pub mod errors;
pub mod state;

use errors::SolFactoryError;
use state::CollectionState;

declare_id!("133wgvX88vqPu8qYEVm18aWgTn1CVtYjcEUXvmnyeWWN");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// Platform fee: 0.15 SOL (in lamports)
pub const PLATFORM_FEE: u64 = 150_000_000;

/// Royalty basis points applied to every NFT minted through this program (8%)
pub const ROYALTY_BPS: u16 = 800;

/// Replace this with your actual platform wallet before deploying.
pub const PLATFORM_WALLET: Pubkey =
    solana_program::pubkey!("5dPJ1zx5Sx3KxUxdWLMivw6hV4DKUg5YUqcwSPXc5g4S");

// ---------------------------------------------------------------------------
// Program
// ---------------------------------------------------------------------------

#[program]
pub mod sol_factory {
    use super::*;

    /// Create a new mpl-core Collection, mint NFT #1 to the creator, and pay
    /// the 0.15 SOL platform fee — all in a single atomic transaction.
    ///
    /// The mpl-core collection's update_authority is set to a program PDA
    /// (["authority", collection_mint]) so that future mints via `mint_nft`
    /// can be authorised by the program without requiring the creator to sign.
    pub fn initialize_collection(
        ctx: Context<InitializeCollection>,
        name: String,
        symbol: String,
        supply: u64,
        mint_price: u64,
        uri: String,
    ) -> Result<()> {
        // ── Input validation ────────────────────────────────────────────────
        require!(name.len() <= CollectionState::MAX_NAME_LEN, SolFactoryError::NameTooLong);
        require!(symbol.len() <= CollectionState::MAX_SYMBOL_LEN, SolFactoryError::SymbolTooLong);
        require!(supply >= 1, SolFactoryError::InvalidSupply);

        // ── Step 1: Transfer 0.15 SOL from creator → platform wallet ────────
        transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.creator.to_account_info(),
                    to:   ctx.accounts.platform_wallet.to_account_info(),
                },
            ),
            PLATFORM_FEE,
        )?;

        // ── Step 2: Create the mpl-core Collection ──────────────────────────
        // update_authority = program PDA so mint_nft never needs creator sig
        CreateCollectionV1CpiBuilder::new(&ctx.accounts.mpl_core_program)
            .collection(&ctx.accounts.collection.to_account_info())
            .payer(&ctx.accounts.creator.to_account_info())
            .update_authority(Some(&ctx.accounts.collection_authority.to_account_info()))
            .system_program(&ctx.accounts.system_program.to_account_info())
            .name(name.clone())
            .uri(uri.clone())
            .invoke()?;

        // ── Step 3: Mint NFT #1 to the creator — PDA signs as authority ─────
        let nft_name       = format!("{} #1", name);
        let collection_key = ctx.accounts.collection.key();
        let auth_bump      = ctx.bumps.collection_authority;

        CreateV1CpiBuilder::new(&ctx.accounts.mpl_core_program)
            .asset(&ctx.accounts.nft_mint.to_account_info())
            .collection(Some(&ctx.accounts.collection.to_account_info()))
            .payer(&ctx.accounts.creator.to_account_info())
            .owner(Some(&ctx.accounts.creator.to_account_info()))
            .authority(Some(&ctx.accounts.collection_authority.to_account_info()))
            .system_program(&ctx.accounts.system_program.to_account_info())
            .name(nft_name)
            .uri(uri)
            .plugins(vec![PluginAuthorityPair {
                plugin: Plugin::Royalties(Royalties {
                    basis_points: ROYALTY_BPS,
                    creators: vec![Creator {
                        address:    ctx.accounts.creator.key(),
                        percentage: 100,
                    }],
                    rule_set: RuleSet::None,
                }),
                authority: None,
            }])
            .invoke_signed(&[&[
                b"authority",
                collection_key.as_ref(),
                &[auth_bump],
            ]])?;

        // ── Step 4: Persist CollectionState PDA ─────────────────────────────
        let state = &mut ctx.accounts.collection_state;
        state.name                = name;
        state.symbol              = symbol;
        state.supply              = supply;
        state.mint_price          = mint_price;
        state.minted_count        = 1; // NFT #1 just minted
        state.creator             = ctx.accounts.creator.key();
        state.collection_mint     = ctx.accounts.collection.key();
        state.bump                = ctx.bumps.collection_state;
        state.authority_bump      = auth_bump;
        state.public_mint_enabled = true;

        Ok(())
    }

    /// Mint the next NFT in a collection to the buyer.
    ///
    /// Only the `buyer` signs — the program PDA acts as collection authority
    /// via `invoke_signed`, so the creator does NOT need to co-sign.
    /// The buyer pays `mint_price` SOL directly to the creator's wallet.
    /// Blocked if `public_mint_enabled` is false — use `creator_mint_to` instead.
    pub fn mint_nft(ctx: Context<MintNft>, uri: String) -> Result<()> {
        // ── Public-mint gate ────────────────────────────────────────────────
        require!(
            ctx.accounts.collection_state.public_mint_enabled,
            SolFactoryError::PublicMintDisabled
        );

        // ── Supply cap check ────────────────────────────────────────────────
        require!(
            ctx.accounts.collection_state.minted_count < ctx.accounts.collection_state.supply,
            SolFactoryError::CollectionFullyMinted
        );

        let mint_price = ctx.accounts.collection_state.mint_price;

        // ── Transfer mint_price SOL from buyer → creator ─────────────────
        transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to:   ctx.accounts.creator.to_account_info(),
                },
            ),
            mint_price,
        )?;

        // ── Mint next NFT to buyer — PDA signs as collection authority ───
        let next_number    = ctx.accounts.collection_state.minted_count
            .checked_add(1)
            .ok_or(SolFactoryError::ArithmeticOverflow)?;
        let nft_name       = format!("{} #{}", ctx.accounts.collection_state.name, next_number);
        let creator_key    = ctx.accounts.collection_state.creator;
        let collection_key = ctx.accounts.collection.key();
        let auth_bump      = ctx.accounts.collection_state.authority_bump;

        CreateV1CpiBuilder::new(&ctx.accounts.mpl_core_program)
            .asset(&ctx.accounts.nft_mint.to_account_info())
            .collection(Some(&ctx.accounts.collection.to_account_info()))
            .payer(&ctx.accounts.buyer.to_account_info())
            .owner(Some(&ctx.accounts.buyer.to_account_info()))
            .authority(Some(&ctx.accounts.collection_authority.to_account_info()))
            .system_program(&ctx.accounts.system_program.to_account_info())
            .name(nft_name)
            .uri(uri)
            .plugins(vec![PluginAuthorityPair {
                plugin: Plugin::Royalties(Royalties {
                    basis_points: ROYALTY_BPS,
                    creators: vec![Creator {
                        address:    creator_key,
                        percentage: 100,
                    }],
                    rule_set: RuleSet::None,
                }),
                authority: None,
            }])
            .invoke_signed(&[&[
                b"authority",
                collection_key.as_ref(),
                &[auth_bump],
            ]])?;

        // ── Increment minted_count ──────────────────────────────────────
        ctx.accounts.collection_state.minted_count = next_number;

        Ok(())
    }

    /// Mint the next NFT directly to an arbitrary recipient address.
    ///
    /// Only the collection `creator` can call this — no SOL transfer occurs.
    /// Works regardless of `public_mint_enabled`, so creators can always
    /// distribute NFTs (loyalty rewards, gifts, airdrop) even when public
    /// minting is paused.
    pub fn creator_mint_to(ctx: Context<CreatorMintTo>, uri: String) -> Result<()> {
        // ── Supply cap check ────────────────────────────────────────────────
        require!(
            ctx.accounts.collection_state.minted_count < ctx.accounts.collection_state.supply,
            SolFactoryError::CollectionFullyMinted
        );

        let next_number    = ctx.accounts.collection_state.minted_count
            .checked_add(1)
            .ok_or(SolFactoryError::ArithmeticOverflow)?;
        let nft_name       = format!("{} #{}", ctx.accounts.collection_state.name, next_number);
        let creator_key    = ctx.accounts.collection_state.creator;
        let collection_key = ctx.accounts.collection.key();
        let auth_bump      = ctx.accounts.collection_state.authority_bump;

        // ── Mint NFT to recipient — PDA signs as collection authority ───
        CreateV1CpiBuilder::new(&ctx.accounts.mpl_core_program)
            .asset(&ctx.accounts.nft_mint.to_account_info())
            .collection(Some(&ctx.accounts.collection.to_account_info()))
            .payer(&ctx.accounts.creator.to_account_info())
            .owner(Some(&ctx.accounts.recipient.to_account_info()))
            .authority(Some(&ctx.accounts.collection_authority.to_account_info()))
            .system_program(&ctx.accounts.system_program.to_account_info())
            .name(nft_name)
            .uri(uri)
            .plugins(vec![PluginAuthorityPair {
                plugin: Plugin::Royalties(Royalties {
                    basis_points: ROYALTY_BPS,
                    creators: vec![Creator {
                        address:    creator_key,
                        percentage: 100,
                    }],
                    rule_set: RuleSet::None,
                }),
                authority: None,
            }])
            .invoke_signed(&[&[
                b"authority",
                collection_key.as_ref(),
                &[auth_bump],
            ]])?;

        ctx.accounts.collection_state.minted_count = next_number;

        Ok(())
    }

    /// Enable or disable public minting for a collection.
    ///
    /// Only the collection `creator` can call this.
    /// When `enabled` is false, `mint_nft` is blocked; `creator_mint_to` still works.
    pub fn toggle_public_mint(ctx: Context<TogglePublicMint>, enabled: bool) -> Result<()> {
        ctx.accounts.collection_state.public_mint_enabled = enabled;
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Accounts — InitializeCollection
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct InitializeCollection<'info> {
    /// The artist / collection creator; pays platform fee + rent.
    #[account(mut)]
    pub creator: Signer<'info>,

    /// Platform fee recipient.
    ///
    /// CHECK: address verified against the PLATFORM_WALLET constant.
    #[account(
        mut,
        constraint = platform_wallet.key() == PLATFORM_WALLET
            @ SolFactoryError::InvalidPlatformWallet
    )]
    pub platform_wallet: UncheckedAccount<'info>,

    /// New mpl-core Collection asset account (fresh keypair; must sign).
    ///
    /// CHECK: created and validated by mpl-core's CreateCollectionV1 CPI.
    #[account(mut)]
    pub collection: Signer<'info>,

    /// New mpl-core Asset account for NFT #1 (fresh keypair; must sign).
    ///
    /// CHECK: created and validated by mpl-core's CreateV1 CPI.
    #[account(mut)]
    pub nft_mint: Signer<'info>,

    /// CollectionState PDA — one per collection, used for indexing & supply.
    /// Seeds: ["collection", creator, collection_mint]
    #[account(
        init,
        payer  = creator,
        space  = CollectionState::LEN,
        seeds  = [b"collection", creator.key().as_ref(), collection.key().as_ref()],
        bump,
    )]
    pub collection_state: Account<'info, CollectionState>,

    /// Program PDA that acts as the mpl-core collection's update_authority.
    /// Seeds: ["authority", collection_mint]
    /// Stored in collection_state.authority_bump for future instructions.
    ///
    /// CHECK: PDA derived from seeds; signs mpl-core CPIs via invoke_signed.
    #[account(
        seeds = [b"authority", collection.key().as_ref()],
        bump,
    )]
    pub collection_authority: UncheckedAccount<'info>,

    /// CHECK: verified by address constraint — must be the mpl-core program.
    #[account(address = mpl_core::ID)]
    pub mpl_core_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

// ---------------------------------------------------------------------------
// Accounts — MintNft
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct MintNft<'info> {
    /// Buyer — pays the mint price and receives the NFT. Only required signer.
    #[account(mut)]
    pub buyer: Signer<'info>,

    /// Creator — receives the mint payment. No signature required; identity
    /// is verified by the collection_state PDA constraint.
    ///
    /// CHECK: key equality verified by collection_state.creator constraint.
    #[account(
        mut,
        constraint = creator.key() == collection_state.creator
            @ SolFactoryError::InvalidCreator
    )]
    pub creator: UncheckedAccount<'info>,

    /// The mpl-core Collection asset.
    ///
    /// CHECK: key equality verified by collection_state.collection_mint constraint.
    #[account(
        mut,
        constraint = collection.key() == collection_state.collection_mint
            @ SolFactoryError::InvalidCollection
    )]
    pub collection: UncheckedAccount<'info>,

    /// New mpl-core Asset account for this NFT (fresh keypair; must sign).
    ///
    /// CHECK: created and validated by mpl-core's CreateV1 CPI.
    #[account(mut)]
    pub nft_mint: Signer<'info>,

    /// CollectionState PDA — seeds verify creator & collection implicitly.
    #[account(
        mut,
        seeds = [b"collection", creator.key().as_ref(), collection.key().as_ref()],
        bump  = collection_state.bump,
    )]
    pub collection_state: Account<'info, CollectionState>,

    /// Program PDA that signs the mpl-core CreateV1 CPI as collection authority.
    /// Seeds and bump verified against collection_state.authority_bump.
    ///
    /// CHECK: PDA derived from seeds; signs via invoke_signed.
    #[account(
        seeds = [b"authority", collection.key().as_ref()],
        bump  = collection_state.authority_bump,
    )]
    pub collection_authority: UncheckedAccount<'info>,

    /// CHECK: verified by address constraint — must be the mpl-core program.
    #[account(address = mpl_core::ID)]
    pub mpl_core_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

// ---------------------------------------------------------------------------
// Accounts — CreatorMintTo
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct CreatorMintTo<'info> {
    /// Collection creator — must sign; pays rent for the new NFT asset.
    /// Verified by the collection_state PDA seeds.
    #[account(mut)]
    pub creator: Signer<'info>,

    /// Recipient — receives the minted NFT; no signature needed.
    ///
    /// CHECK: arbitrary recipient address; ownership set by mpl-core.
    pub recipient: UncheckedAccount<'info>,

    /// The mpl-core Collection asset.
    ///
    /// CHECK: key equality verified by collection_state.collection_mint constraint.
    #[account(
        mut,
        constraint = collection.key() == collection_state.collection_mint
            @ SolFactoryError::InvalidCollection
    )]
    pub collection: UncheckedAccount<'info>,

    /// New mpl-core Asset account for this NFT (fresh keypair; must sign).
    ///
    /// CHECK: created and validated by mpl-core's CreateV1 CPI.
    #[account(mut)]
    pub nft_mint: Signer<'info>,

    /// CollectionState PDA — seeds verify creator & collection implicitly.
    #[account(
        mut,
        seeds = [b"collection", creator.key().as_ref(), collection.key().as_ref()],
        bump  = collection_state.bump,
    )]
    pub collection_state: Account<'info, CollectionState>,

    /// Program PDA that signs the mpl-core CreateV1 CPI as collection authority.
    ///
    /// CHECK: PDA derived from seeds; signs via invoke_signed.
    #[account(
        seeds = [b"authority", collection.key().as_ref()],
        bump  = collection_state.authority_bump,
    )]
    pub collection_authority: UncheckedAccount<'info>,

    /// CHECK: verified by address constraint — must be the mpl-core program.
    #[account(address = mpl_core::ID)]
    pub mpl_core_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

// ---------------------------------------------------------------------------
// Accounts — TogglePublicMint
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct TogglePublicMint<'info> {
    /// Collection creator — must sign to authorise the toggle.
    /// Verified implicitly via PDA seeds.
    #[account(mut)]
    pub creator: Signer<'info>,

    /// Needed only to re-derive the PDA seeds; not modified.
    ///
    /// CHECK: key equality verified by collection_state.collection_mint constraint.
    #[account(
        constraint = collection.key() == collection_state.collection_mint
            @ SolFactoryError::InvalidCollection
    )]
    pub collection: UncheckedAccount<'info>,

    /// CollectionState PDA — seeds bind both creator and collection,
    /// so only the real creator can pass a valid collection_state.
    #[account(
        mut,
        seeds = [b"collection", creator.key().as_ref(), collection.key().as_ref()],
        bump  = collection_state.bump,
    )]
    pub collection_state: Account<'info, CollectionState>,

    pub system_program: Program<'info, System>,
}
