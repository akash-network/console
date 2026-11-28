import { z } from "zod";

export const SEED_VERSION_PATTERN = /^v[1-9]\d*$/;

/** The seed every wallet is derived from unless a request names another, which is what callers older than seed versions rely on. */
export const DEFAULT_SEED_VERSION = "v2";

/** Kept only so usage history can name the earlier address of a first-generation wallet. */
export const ADDRESS_ONLY_SEED_VERSIONS: ReadonlySet<string> = new Set(["v1"]);

export const SeedVersionSchema = z.string().regex(SEED_VERSION_PATTERN, { message: "A seed version looks like v2" });
