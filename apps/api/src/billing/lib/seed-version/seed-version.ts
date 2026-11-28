/** The width of the column a wallet row keeps its seed version in. */
export const MAX_SEED_VERSION_LENGTH = 16;

/** The signer keeps this seed to answer first-generation addresses only, so a wallet made from it could never spend. */
export const ADDRESS_ONLY_SEED_VERSION = "v1";
