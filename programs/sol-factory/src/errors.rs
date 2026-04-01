use anchor_lang::prelude::*;

#[error_code]
pub enum SolFactoryError {
    #[msg("Collection is fully minted — minted_count has reached supply")]
    CollectionFullyMinted,

    #[msg("Platform wallet does not match the PLATFORM_WALLET constant")]
    InvalidPlatformWallet,

    #[msg("Arithmetic overflow in minted_count increment")]
    ArithmeticOverflow,

    #[msg("Name exceeds the 32-character limit")]
    NameTooLong,

    #[msg("Symbol exceeds the 10-character limit")]
    SymbolTooLong,

    #[msg("Supply must be at least 1")]
    InvalidSupply,

    #[msg("Creator account does not match collection state")]
    InvalidCreator,

    #[msg("Collection account does not match collection state")]
    InvalidCollection,
}
