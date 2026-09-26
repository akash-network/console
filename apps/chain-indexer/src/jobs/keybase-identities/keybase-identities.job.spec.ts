import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { envSchema } from "@src/config/env.config";
import { KeybaseIdentitiesJob } from "@src/jobs/keybase-identities/keybase-identities.job";
import type { ChainDatabase } from "@src/providers/db.provider";
import type { Fetch } from "@src/providers/fetch.provider";
import type { LoggerService } from "@src/providers/logging.provider";

describe(KeybaseIdentitiesJob.name, () => {
  it("counts a validator whose write fails as unresolved and still records the others", async () => {
    const { job, logger, updates } = setup({ failWriteFor: "akashvaloper1flaky" });

    await job.run(new AbortController().signal);

    expect(updates).toEqual(["akashvaloper1flaky", "akashvaloper1found"]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "KEYBASE_UPDATE_FAILED",
        operatorAddress: "akashvaloper1flaky",
        error: expect.objectContaining({ message: "connection reset" })
      })
    );
    expect(logger.info).toHaveBeenLastCalledWith(
      expect.objectContaining({ event: "KEYBASE_IDENTITIES_SYNCED", validators: 2, resolved: 1, unresolved: 1, invalid: 0 })
    );
  });

  function setup(input: { failWriteFor: string }) {
    const config = envSchema.parse({
      POSTGRES_DB_URI: "postgres://unit:unit@localhost:5432/unit",
      INDEXER_ROLE: "jobs",
      KEYBASE_API_URL: "https://keybase.test/_/api/1.0"
    });
    const updates: string[] = [];
    const dbFake = {
      select: () => ({
        from: () => ({
          where: () =>
            Promise.resolve([
              { operatorAddress: "akashvaloper1flaky", identity: "ABCDEF0123456789" },
              { operatorAddress: "akashvaloper1found", identity: "0123456789ABCDEF" }
            ])
        })
      }),
      update: () => ({
        set: () => ({
          where: (condition: unknown) => {
            const [operatorAddress] = new PgDialect().sqlToQuery(condition as SQL).params as string[];
            updates.push(operatorAddress);
            return operatorAddress === input.failWriteFor ? Promise.reject(new Error("connection reset")) : Promise.resolve();
          }
        })
      })
    };
    const fetch = vi.fn<Fetch>(async () =>
      Response.json({ status: { name: "OK" }, them: [{ basics: { username: "alice" }, pictures: { primary: { url: "https://keybase.io/alice.png" } } }] })
    );
    const logger = mock<LoggerService>();
    const job = new KeybaseIdentitiesJob(dbFake as unknown as ChainDatabase, fetch, config, logger);
    return { job, logger, updates };
  }
});
