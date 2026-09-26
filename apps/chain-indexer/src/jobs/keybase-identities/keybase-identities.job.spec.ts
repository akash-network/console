import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { envSchema } from "@src/config/env.config";
import { KeybaseIdentitiesJob } from "@src/jobs/keybase-identities/keybase-identities.job";
import type { ChainDatabase } from "@src/providers/db.provider";
import type { Fetch } from "@src/providers/fetch.provider";
import type { LoggerService } from "@src/providers/logging.provider";

const FOUND = { operatorAddress: "akashvaloper1found", identity: "0123456789ABCDEF", keybaseUsername: null };

describe(KeybaseIdentitiesJob.name, () => {
  it("counts a validator whose write fails as unresolved and still records the others", async () => {
    const { job, logger, updates } = setup({
      validators: [{ operatorAddress: "akashvaloper1flaky", identity: "ABCDEF0123456789", keybaseUsername: null }, FOUND],
      lookup: "found",
      failWriteFor: "akashvaloper1flaky"
    });

    await job.run(new AbortController().signal);

    expect(updates.map(update => update.operatorAddress)).toEqual(["akashvaloper1flaky", "akashvaloper1found"]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "KEYBASE_UPDATE_FAILED",
        operatorAddress: "akashvaloper1flaky",
        error: expect.objectContaining({ message: "connection reset" })
      })
    );
    expect(logger.info).toHaveBeenLastCalledWith(
      expect.objectContaining({ event: "KEYBASE_IDENTITIES_SYNCED", validators: 2, resolved: 1, unresolved: 1, invalid: 0, cleared: 0 })
    );
  });

  it("clears the username and avatar of a validator whose identity was removed", async () => {
    const { job, logger, updates, fetch } = setup({
      validators: [{ operatorAddress: "akashvaloper1gone", identity: null, keybaseUsername: "old" }],
      lookup: "found"
    });

    await job.run(new AbortController().signal);

    expect(updates).toEqual([{ operatorAddress: "akashvaloper1gone", values: { keybaseUsername: null, keybaseAvatarUrl: null } }]);
    expect(fetch).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenLastCalledWith(expect.objectContaining({ event: "KEYBASE_IDENTITIES_SYNCED", cleared: 1 }));
  });

  it("clears them when the identity no longer maps to a keybase user", async () => {
    const { job, logger, updates } = setup({ validators: [{ ...FOUND, keybaseUsername: "old" }], lookup: "missing" });

    await job.run(new AbortController().signal);

    expect(updates).toEqual([{ operatorAddress: "akashvaloper1found", values: { keybaseUsername: null, keybaseAvatarUrl: null } }]);
    expect(logger.info).toHaveBeenLastCalledWith(expect.objectContaining({ event: "KEYBASE_IDENTITIES_SYNCED", cleared: 1, resolved: 0 }));
  });

  it("clears them when the identity is malformed", async () => {
    const { job, updates } = setup({ validators: [{ operatorAddress: "akashvaloper1bad", identity: "not-a-key", keybaseUsername: "old" }], lookup: "found" });

    await job.run(new AbortController().signal);

    expect(updates).toEqual([{ operatorAddress: "akashvaloper1bad", values: { keybaseUsername: null, keybaseAvatarUrl: null } }]);
  });

  it("keeps them when the lookup itself fails, to retry on the next run", async () => {
    const { job, logger, updates } = setup({ validators: [{ ...FOUND, keybaseUsername: "old" }], lookup: "failed" });

    await job.run(new AbortController().signal);

    expect(updates).toEqual([]);
    expect(logger.info).toHaveBeenLastCalledWith(expect.objectContaining({ event: "KEYBASE_IDENTITIES_SYNCED", unresolved: 1, cleared: 0 }));
  });

  function setup(input: {
    validators: { operatorAddress: string; identity: string | null; keybaseUsername: string | null }[];
    lookup: "found" | "missing" | "failed";
    failWriteFor?: string;
  }) {
    const config = envSchema.parse({
      POSTGRES_DB_URI: "postgres://unit:unit@localhost:5432/unit",
      INDEXER_ROLE: "jobs",
      KEYBASE_API_URL: "https://keybase.test/_/api/1.0"
    });
    const updates: { operatorAddress: string; values: Record<string, unknown> }[] = [];
    const dbFake = {
      select: () => ({ from: () => ({ where: () => Promise.resolve(input.validators) }) }),
      update: () => ({
        set: (values: Record<string, unknown>) => ({
          where: (condition: unknown) => {
            const [operatorAddress] = new PgDialect().sqlToQuery(condition as SQL).params as string[];
            if (operatorAddress === input.failWriteFor) {
              updates.push({ operatorAddress, values });
              return Promise.reject(new Error("connection reset"));
            }
            updates.push({ operatorAddress, values });
            return Promise.resolve();
          }
        })
      })
    };
    const fetch = vi.fn<Fetch>(async () => {
      if (input.lookup === "failed") return new Response("down", { status: 503 });
      const them = input.lookup === "found" ? [{ basics: { username: "alice" }, pictures: { primary: { url: "https://keybase.io/alice.png" } } }] : [];
      return Response.json({ status: { name: "OK" }, them });
    });
    const logger = mock<LoggerService>();
    const job = new KeybaseIdentitiesJob(dbFake as unknown as ChainDatabase, fetch, config, logger);
    return { job, logger, updates, fetch };
  }
});
