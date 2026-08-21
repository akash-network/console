/** Raised when balance tracking would start past the network's genesis height; fatal by design so balances are never seeded from an incomplete history. */
export class GenesisMidChainError extends Error {}
