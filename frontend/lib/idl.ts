// Anchor IDL for sol_factory — program 133wgvX88vqPu8qYEVm18aWgTn1CVtYjcEUXvmnyeWWN
// Anchor 0.30.1 format: program address must be at top-level "address" field.

export const IDL = {
  address: "133wgvX88vqPu8qYEVm18aWgTn1CVtYjcEUXvmnyeWWN",
  version: "0.1.0",
  name: "sol_factory",
  instructions: [
    {
      name: "initializeCollection",
      accounts: [
        { name: "creator",             isMut: true,  isSigner: true  },
        { name: "platformWallet",      isMut: true,  isSigner: false },
        { name: "collection",          isMut: true,  isSigner: true  },
        { name: "nftMint",             isMut: true,  isSigner: true  },
        { name: "collectionState",     isMut: true,  isSigner: false },
        { name: "collectionAuthority", isMut: false, isSigner: false },
        { name: "mplCoreProgram",      isMut: false, isSigner: false },
        { name: "systemProgram",       isMut: false, isSigner: false },
      ],
      args: [
        { name: "name",      type: "string" },
        { name: "symbol",    type: "string" },
        { name: "supply",    type: "u64"    },
        { name: "mintPrice", type: "u64"    },
        { name: "uri",       type: "string" },
      ],
    },
    {
      name: "creatorMintTo",
      accounts: [
        { name: "creator",             isMut: true,  isSigner: true  },
        { name: "recipient",           isMut: false, isSigner: false },
        { name: "collection",          isMut: true,  isSigner: false },
        { name: "nftMint",             isMut: true,  isSigner: true  },
        { name: "collectionState",     isMut: true,  isSigner: false },
        { name: "collectionAuthority", isMut: false, isSigner: false },
        { name: "mplCoreProgram",      isMut: false, isSigner: false },
        { name: "systemProgram",       isMut: false, isSigner: false },
      ],
      args: [
        { name: "uri", type: "string" },
      ],
    },
    {
      name: "togglePublicMint",
      accounts: [
        { name: "creator",         isMut: true,  isSigner: true  },
        { name: "collection",      isMut: false, isSigner: false },
        { name: "collectionState", isMut: true,  isSigner: false },
        { name: "systemProgram",   isMut: false, isSigner: false },
      ],
      args: [
        { name: "enabled", type: "bool" },
      ],
    },
    {
      name: "mintNft",
      accounts: [
        { name: "buyer",               isMut: true,  isSigner: true  },
        { name: "creator",             isMut: true,  isSigner: false },
        { name: "collection",          isMut: true,  isSigner: false },
        { name: "nftMint",             isMut: true,  isSigner: true  },
        { name: "collectionState",     isMut: true,  isSigner: false },
        { name: "collectionAuthority", isMut: false, isSigner: false },
        { name: "mplCoreProgram",      isMut: false, isSigner: false },
        { name: "systemProgram",       isMut: false, isSigner: false },
      ],
      args: [
        { name: "uri", type: "string" },
      ],
    },
  ],
  accounts: [
    {
      name: "CollectionState",
      type: {
        kind: "struct",
        fields: [
          { name: "name",              type: "string"    },
          { name: "symbol",            type: "string"    },
          { name: "supply",            type: "u64"       },
          { name: "mintPrice",         type: "u64"       },
          { name: "mintedCount",       type: "u64"       },
          { name: "creator",           type: "publicKey" },
          { name: "collectionMint",    type: "publicKey" },
          { name: "bump",              type: "u8"        },
          { name: "authorityBump",     type: "u8"        },
          { name: "publicMintEnabled", type: "bool"      },
        ],
      },
    },
  ],
  metadata: {
    address: "133wgvX88vqPu8qYEVm18aWgTn1CVtYjcEUXvmnyeWWN",
  },
  errors: [
    { code: 6000, name: "CollectionFullyMinted", msg: "This collection has been fully minted."                        },
    { code: 6001, name: "InvalidPlatformWallet",  msg: "The platform wallet address is invalid."                      },
    { code: 6002, name: "ArithmeticOverflow",     msg: "Arithmetic overflow."                                         },
    { code: 6003, name: "NameTooLong",            msg: "Collection name exceeds 32 characters."                       },
    { code: 6004, name: "SymbolTooLong",          msg: "Symbol exceeds 10 characters."                                },
    { code: 6005, name: "InvalidSupply",          msg: "Supply must be at least 1."                                   },
    { code: 6006, name: "InvalidCreator",         msg: "Creator does not match collection state."                     },
    { code: 6007, name: "InvalidCollection",      msg: "Collection does not match collection state."                  },
    { code: 6008, name: "PublicMintDisabled",     msg: "Public minting is currently disabled for this collection."    },
  ],
} as const;

export type SolFactoryIdl = typeof IDL;
