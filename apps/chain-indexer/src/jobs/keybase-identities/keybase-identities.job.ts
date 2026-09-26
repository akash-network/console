import { and, eq, isNotNull, ne, or } from "drizzle-orm";
import { inject, singleton } from "tsyringe";

import type { EnvConfig } from "@src/config/env.config";
import { Validators } from "@src/db/schema";
import { mapWithConcurrency } from "@src/lib/map-with-concurrency/map-with-concurrency";
import { APP_CONFIG } from "@src/providers/app-config.provider";
import type { ChainDatabase } from "@src/providers/db.provider";
import { CHAIN_DB } from "@src/providers/db.provider";
import type { Fetch } from "@src/providers/fetch.provider";
import { FETCH } from "@src/providers/fetch.provider";
import { LoggerService } from "@src/providers/logging.provider";

/** A validator's `identity` is a Keybase PGP key suffix: 16 hex characters. */
const KEYBASE_IDENTITY_PATTERN = /^[A-F0-9]{16}$/i;
const LOOKUP_CONCURRENCY = 4;

type LookupOutcome = "resolved" | "unresolved" | "invalid" | "cleared";

type KeybaseUser = NonNullable<KeybaseLookupResponse["them"]>[number];

type Lookup = { kind: "found"; user: KeybaseUser } | { kind: "missing" } | { kind: "failed" };

const CLEARED = { keybaseUsername: null, keybaseAvatarUrl: null };

interface KeybaseLookupResponse {
  status?: { name?: string };
  them?: Array<{ basics?: { username?: string }; pictures?: { primary?: { url?: string } } }>;
}

/** Resolves each validator's Keybase identity to a username and avatar and clears them once the identity is gone, malformed or unknown to Keybase; a lookup or write that fails is logged and retried on the next run, not fatal. */
@singleton()
export class KeybaseIdentitiesJob {
  readonly #db: ChainDatabase;
  readonly #fetch: Fetch;
  readonly #config: EnvConfig;
  readonly #logger: LoggerService;

  constructor(
    @inject(CHAIN_DB) db: ChainDatabase,
    @inject(FETCH) fetch: Fetch,
    @inject(APP_CONFIG) config: EnvConfig,
    @inject(LoggerService) logger: LoggerService
  ) {
    this.#db = db;
    this.#fetch = fetch;
    this.#config = config;
    this.#logger = logger;
    this.#logger.setContext("KEYBASE_IDENTITIES");
  }

  async run(signal: AbortSignal): Promise<void> {
    const validators = await this.#db
      .select({ operatorAddress: Validators.operatorAddress, identity: Validators.identity })
      .from(Validators)
      .where(or(and(isNotNull(Validators.identity), ne(Validators.identity, "")), isNotNull(Validators.keybaseUsername)));

    const outcomes = await mapWithConcurrency(validators, LOOKUP_CONCURRENCY, validator =>
      this.#resolve(validator.operatorAddress, validator.identity ?? "", signal)
    );

    this.#logger.info({
      event: "KEYBASE_IDENTITIES_SYNCED",
      validators: validators.length,
      resolved: outcomes.filter(outcome => outcome === "resolved").length,
      unresolved: outcomes.filter(outcome => outcome === "unresolved").length,
      invalid: outcomes.filter(outcome => outcome === "invalid").length,
      cleared: outcomes.filter(outcome => outcome === "cleared").length
    });
  }

  async #resolve(operatorAddress: string, identity: string, signal: AbortSignal): Promise<LookupOutcome> {
    if (identity === "") {
      return (await this.#write(operatorAddress, CLEARED)) ? "cleared" : "unresolved";
    }
    if (!KEYBASE_IDENTITY_PATTERN.test(identity)) {
      this.#logger.warn({ event: "KEYBASE_IDENTITY_INVALID", operatorAddress, identity });
      return (await this.#write(operatorAddress, CLEARED)) ? "invalid" : "unresolved";
    }

    const lookup = await this.#lookup(operatorAddress, identity, signal);
    if (lookup.kind === "failed") {
      return "unresolved";
    }
    if (lookup.kind === "missing") {
      return (await this.#write(operatorAddress, CLEARED)) ? "cleared" : "unresolved";
    }
    const { user } = lookup;
    return (await this.#write(operatorAddress, { keybaseUsername: user.basics?.username ?? null, keybaseAvatarUrl: user.pictures?.primary?.url ?? null }))
      ? "resolved"
      : "unresolved";
  }

  async #write(operatorAddress: string, values: { keybaseUsername: string | null; keybaseAvatarUrl: string | null }): Promise<boolean> {
    try {
      await this.#db.update(Validators).set(values).where(eq(Validators.operatorAddress, operatorAddress));
      return true;
    } catch (error) {
      this.#logger.warn({ event: "KEYBASE_UPDATE_FAILED", operatorAddress, error });
      return false;
    }
  }

  async #lookup(operatorAddress: string, identity: string, signal: AbortSignal): Promise<Lookup> {
    try {
      const response = await this.#fetch(`${this.#config.KEYBASE_API_URL}/user/lookup.json?key_suffix=${identity}&fields=basics,pictures`, { signal });
      if (!response.ok) {
        this.#logger.warn({ event: "KEYBASE_LOOKUP_FAILED", operatorAddress, identity, status: response.status });
        return { kind: "failed" };
      }
      const data = (await response.json()) as KeybaseLookupResponse;
      if (data.status?.name !== "OK") {
        this.#logger.warn({ event: "KEYBASE_LOOKUP_FAILED", operatorAddress, identity, status: data.status?.name });
        return { kind: "failed" };
      }
      const user = data.them?.[0];
      return user ? { kind: "found", user } : { kind: "missing" };
    } catch (error) {
      if (signal.aborted) {
        throw error;
      }
      this.#logger.warn({ event: "KEYBASE_LOOKUP_FAILED", operatorAddress, identity, error });
      return { kind: "failed" };
    }
  }
}
