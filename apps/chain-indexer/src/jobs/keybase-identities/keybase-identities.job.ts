import { and, eq, isNotNull, ne } from "drizzle-orm";
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

type LookupOutcome = "resolved" | "unresolved" | "invalid";

interface KeybaseLookupResponse {
  status?: { name?: string };
  them?: Array<{ basics?: { username?: string }; pictures?: { primary?: { url?: string } } }>;
}

/** Resolves each validator's Keybase identity to a username and avatar; a lookup that fails is logged and retried on the next run, not fatal. */
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
      .where(and(isNotNull(Validators.identity), ne(Validators.identity, "")));

    const outcomes = await mapWithConcurrency(validators, LOOKUP_CONCURRENCY, validator =>
      this.#resolve(validator.operatorAddress, validator.identity ?? "", signal)
    );

    this.#logger.info({
      event: "KEYBASE_IDENTITIES_SYNCED",
      validators: validators.length,
      resolved: outcomes.filter(outcome => outcome === "resolved").length,
      unresolved: outcomes.filter(outcome => outcome === "unresolved").length,
      invalid: outcomes.filter(outcome => outcome === "invalid").length
    });
  }

  async #resolve(operatorAddress: string, identity: string, signal: AbortSignal): Promise<LookupOutcome> {
    if (!KEYBASE_IDENTITY_PATTERN.test(identity)) {
      this.#logger.warn({ event: "KEYBASE_IDENTITY_INVALID", operatorAddress, identity });
      return "invalid";
    }

    const user = await this.#lookup(operatorAddress, identity, signal);
    if (!user) {
      return "unresolved";
    }

    await this.#db
      .update(Validators)
      .set({ keybaseUsername: user.basics?.username ?? null, keybaseAvatarUrl: user.pictures?.primary?.url ?? null })
      .where(eq(Validators.operatorAddress, operatorAddress));
    return "resolved";
  }

  async #lookup(operatorAddress: string, identity: string, signal: AbortSignal): Promise<NonNullable<KeybaseLookupResponse["them"]>[number] | undefined> {
    try {
      const response = await this.#fetch(`${this.#config.KEYBASE_API_URL}/user/lookup.json?key_suffix=${identity}&fields=basics,pictures`, { signal });
      if (!response.ok) {
        this.#logger.warn({ event: "KEYBASE_LOOKUP_FAILED", operatorAddress, identity, status: response.status });
        return undefined;
      }
      const data = (await response.json()) as KeybaseLookupResponse;
      return data.status?.name === "OK" ? data.them?.[0] : undefined;
    } catch (error) {
      if (signal.aborted) {
        throw error;
      }
      this.#logger.warn({ event: "KEYBASE_LOOKUP_FAILED", operatorAddress, identity, error });
      return undefined;
    }
  }
}
