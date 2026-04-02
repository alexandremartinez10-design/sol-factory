use anchor_lang::prelude::*;

/// CollectionState PDA
/// Seeds: ["collection", creator_pubkey, collection_mint_pubkey]
///
/// One PDA per collection — used for dashboard indexing and supply enforcement.
#[account]
pub struct CollectionState {
    /// Display name of the collection (max 32 bytes)
    pub name: String,
    /// Ticker symbol (max 10 bytes)
    pub symbol: String,
    /// Maximum number of NFTs that can ever be minted (including #1)
    pub supply: u64,
    /// Lamports charged per public mint
    pub mint_price: u64,
    /// How many NFTs have been minted so far (starts at 1 after initialize_collection)
    pub minted_count: u64,
    /// The wallet that created (and can authorize mints for) this collection
    pub creator: Pubkey,
    /// The mpl-core Collection asset address
    pub collection_mint: Pubkey,
    /// PDA bump stored to skip re-derivation in future instructions
    pub bump: u8,
    /// Bump for the ["authority", collection_mint] PDA that acts as
    /// the mpl-core collection update_authority (enables serverless minting)
    pub authority_bump: u8,
    /// When false, the public mint_nft instruction is blocked.
    /// Creator can still mint to any address via creator_mint_to.
    /// Toggled by toggle_public_mint; initialised to true.
    pub public_mint_enabled: bool,
}

impl CollectionState {
    pub const MAX_NAME_LEN: usize = 32;
    pub const MAX_SYMBOL_LEN: usize = 10;

    pub const LEN: usize = 8                        // Anchor discriminator
        + 4 + Self::MAX_NAME_LEN                    // name   String (prefix + data)
        + 4 + Self::MAX_SYMBOL_LEN                  // symbol String (prefix + data)
        + 8                                         // supply
        + 8                                         // mint_price
        + 8                                         // minted_count
        + 32                                        // creator   Pubkey
        + 32                                        // collection_mint Pubkey
        + 1                                         // bump
        + 1                                         // authority_bump
        + 1;                                        // public_mint_enabled
    // Total: 149 bytes
}
