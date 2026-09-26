import { container } from "tsyringe";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { envSchema } from "@src/config/env.config";
import { Validators } from "@src/db/schema";
import { KeybaseIdentitiesJob } from "@src/jobs/keybase-identities/keybase-identities.job";
import type { ChainDatabase } from "@src/providers/db.provider";
import { CHAIN_DB } from "@src/providers/db.provider";
import type { Fetch } from "@src/providers/fetch.provider";
import type { LoggerService } from "@src/providers/logging.provider";

describe(KeybaseIdentitiesJob.name, () => {
  it("resolves every validator with a keybase identity to its username and avatar", async () => {
    const { job, db, fetch } = await setup();

    await job.run(new AbortController().signal);

    expect(
      await db
        .select({ operatorAddress: Validators.operatorAddress, keybaseUsername: Validators.keybaseUsername, keybaseAvatarUrl: Validators.keybaseAvatarUrl })
        .from(Validators)
        .orderBy(Validators.operatorAddress)
    ).toEqual([
      { operatorAddress: "akashvaloper1found", keybaseUsername: "alice", keybaseAvatarUrl: "https://keybase.io/alice.png" },
      { operatorAddress: "akashvaloper1invalid", keybaseUsername: null, keybaseAvatarUrl: null },
      { operatorAddress: "akashvaloper1none", keybaseUsername: null, keybaseAvatarUrl: null },
      { operatorAddress: "akashvaloper1unknown", keybaseUsername: null, keybaseAvatarUrl: null }
    ]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledWith("https://keybase.test/_/api/1.0/user/lookup.json?key_suffix=ABCDEF0123456789&fields=basics,pictures", expect.anything());
  });

  it("reports how many lookups were skipped or failed without failing the run", async () => {
    const { job, logger } = await setup();

    await job.run(new AbortController().signal);

    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "KEYBASE_IDENTITY_INVALID", operatorAddress: "akashvaloper1invalid" }));
    expect(logger.info).toHaveBeenLastCalledWith(
      expect.objectContaining({ event: "KEYBASE_IDENTITIES_SYNCED", validators: 3, resolved: 1, unresolved: 1, invalid: 1 })
    );
  });

  async function setup() {
    const db: ChainDatabase = container.resolve(CHAIN_DB);
    await db.delete(Validators);
    await db.insert(Validators).values([
      { operatorAddress: "akashvaloper1found", identity: "ABCDEF0123456789" },
      { operatorAddress: "akashvaloper1unknown", identity: "0000000000000000" },
      { operatorAddress: "akashvaloper1invalid", identity: "not-a-key" },
      { operatorAddress: "akashvaloper1none", identity: null }
    ]);

    const fetch = vi.fn<Fetch>(async input => {
      const url = String(input);
      const found = url.includes("ABCDEF0123456789");
      const body = found
        ? { status: { name: "OK" }, them: [{ basics: { username: "alice" }, pictures: { primary: { url: "https://keybase.io/alice.png" } } }] }
        : { status: { name: "OK" }, them: [] };
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    });
    const config = envSchema.parse({ POSTGRES_DB_URI: process.env.POSTGRES_DB_URI, INDEXER_ROLE: "jobs", KEYBASE_API_URL: "https://keybase.test/_/api/1.0" });
    const logger = mock<LoggerService>();
    const job = new KeybaseIdentitiesJob(db, fetch, config, logger);

    return { job, db, fetch, logger };
  }
});
