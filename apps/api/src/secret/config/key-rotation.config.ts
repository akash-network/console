/** Cloud KMS answers a version's state as the enum's name over REST and as its ordinal over gRPC, and both reach here unchanged. */
export const ENABLED_CRYPTO_KEY_VERSION_STATES: ReadonlySet<unknown> = new Set(["ENABLED", 1]);

export const DEFAULT_KEY_ROTATION_BATCH_SIZE = 100;
