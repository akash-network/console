import { faker } from "@faker-js/faker";
import { subDays, subHours } from "date-fns";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { DeletedTrialAccountRepository } from "./deleted-trial-account.repository";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

describe(DeletedTrialAccountRepository.name, () => {
  describe("findByAnyHashSince", () => {
    it("matches a record by its identity hash or by its email hash", async () => {
      const { repository, record } = await setup();
      const since = subDays(new Date(), 1);

      const [byIdentity, byEmail] = await Promise.all([
        repository.findByAnyHashSince({ identityHash: record.identityHash, emailHash: hash() }, since),
        repository.findByAnyHashSince({ identityHash: hash(), emailHash: record.emailHash }, since)
      ]);

      expect([byIdentity.map(found => found.id), byEmail.map(found => found.id)]).toEqual([[record.id], [record.id]]);
    });

    it("returns every matching record, the latest first", async () => {
      const { repository, record, recordAt } = await setup();
      const older = await recordAt(subHours(new Date(), 5), { identityHash: record.identityHash });
      const oldest = await recordAt(subHours(new Date(), 9), { emailHash: record.emailHash });

      const found = await repository.findByAnyHashSince(record, subDays(new Date(), 1));

      expect(found.map(row => row.id)).toEqual([record.id, older.id, oldest.id]);
    });

    it("leaves out a matching record written before the given moment", async () => {
      const { repository, record, recordAt } = await setup();
      await recordAt(subHours(new Date(), 9), { identityHash: record.identityHash });

      const found = await repository.findByAnyHashSince(record, subHours(new Date(), 5));

      expect(found.map(row => row.id)).toEqual([record.id]);
    });

    it("finds nothing for hashes no record was written under", async () => {
      const { repository } = await setup();

      await expect(repository.findByAnyHashSince({ identityHash: hash(), emailHash: hash() }, subDays(new Date(), 1))).resolves.toEqual([]);
    });

    it("finds nothing without a hash to match, while records exist", async () => {
      const { repository } = await setup();

      await expect(repository.findByAnyHashSince({ identityHash: null, emailHash: null }, subDays(new Date(), 1))).resolves.toEqual([]);
    });
  });

  describe("markRefusedOnce", () => {
    it("marks a record with the refused account once, however often the same account is marked", async () => {
      const { repository, record, findRecord } = await setup();
      const refusedUserId = faker.string.uuid();

      const first = await repository.markRefusedOnce(record.id, refusedUserId);
      const second = await repository.markRefusedOnce(record.id, refusedUserId);

      expect([first, second]).toEqual([true, false]);
      expect(await findRecord(record.id)).toMatchObject({ refusedUserId });
    });

    it("marks a record once when the same account is marked twice at once", async () => {
      const { repository, record } = await setup();
      const refusedUserId = faker.string.uuid();

      const marks = await Promise.all([repository.markRefusedOnce(record.id, refusedUserId), repository.markRefusedOnce(record.id, refusedUserId)]);

      expect(marks.filter(Boolean)).toHaveLength(1);
    });

    it("marks a record again for another refused account", async () => {
      const { repository, record, findRecord } = await setup();
      const anotherUserId = faker.string.uuid();
      await repository.markRefusedOnce(record.id, faker.string.uuid());

      await expect(repository.markRefusedOnce(record.id, anotherUserId)).resolves.toBe(true);
      expect(await findRecord(record.id)).toMatchObject({ refusedUserId: anotherUserId });
    });

    it("marks nothing for a record that does not exist, and leaves the others alone", async () => {
      const { repository, record, findRecord } = await setup();

      await expect(repository.markRefusedOnce(faker.string.uuid(), faker.string.uuid())).resolves.toBe(false);
      expect(await findRecord(record.id)).toMatchObject({ refusedUserId: null });
    });
  });

  describe("clearRefusalsOf", () => {
    it("clears the given account from every record it was refused over and leaves the other accounts' marks", async () => {
      const { repository, record, recordAt, findRecord } = await setup();
      const refusedUserId = faker.string.uuid();
      const anotherUserId = faker.string.uuid();
      const earlier = await recordAt(subHours(new Date(), 5));
      const unrelated = await recordAt(subHours(new Date(), 9));
      await repository.markRefusedOnce(record.id, refusedUserId);
      await repository.markRefusedOnce(earlier.id, refusedUserId);
      await repository.markRefusedOnce(unrelated.id, anotherUserId);

      await repository.clearRefusalsOf(refusedUserId);

      expect([await findRecord(record.id), await findRecord(earlier.id), await findRecord(unrelated.id)]).toMatchObject([
        { refusedUserId: null },
        { refusedUserId: null },
        { refusedUserId: anotherUserId }
      ]);
    });
  });

  describe("deleteOlderThan", () => {
    it("deletes the records written before the given moment and keeps the rest", async () => {
      const { repository, record, recordAt, findRecord } = await setup();
      const stale = await recordAt(subDays(new Date(), 40));

      await repository.deleteOlderThan(subDays(new Date(), 30));

      expect(await findRecord(stale.id)).toBeUndefined();
      expect(await findRecord(record.id)).toMatchObject({ id: record.id });
    });
  });

  function hash() {
    return faker.string.hexadecimal({ length: 64, casing: "lower", prefix: "" });
  }

  async function setup() {
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const table = resolveTable("DeletedTrialAccounts");
    const repository = container.resolve(DeletedTrialAccountRepository);

    async function recordAt(createdAt: Date, hashes: { identityHash?: string; emailHash?: string } = {}) {
      const [row] = await db
        .insert(table)
        .values({ identityHash: hash(), emailHash: hash(), walletAddress: createAkashAddress(), ...hashes, createdAt })
        .returning();

      return row;
    }

    async function findRecord(id: string) {
      const [row] = await db.select().from(table).where(eq(table.id, id));

      return row;
    }

    const record = await recordAt(new Date());

    return { repository, recordAt, findRecord, record: { ...record, identityHash: record.identityHash!, emailHash: record.emailHash! } };
  }
});
