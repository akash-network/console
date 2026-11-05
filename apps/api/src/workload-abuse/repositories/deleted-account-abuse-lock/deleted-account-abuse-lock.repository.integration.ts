import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { ABUSE_LOCK_REASON } from "@src/workload-abuse/lib/abuse-lock-reason/abuse-lock-reason";
import { DeletedAccountAbuseLockRepository } from "./deleted-account-abuse-lock.repository";

describe(DeletedAccountAbuseLockRepository.name, () => {
  describe("findByAnyHash", () => {
    it("matches a remembered lock by its identity hash or by its email hash", async () => {
      const { repository, lock } = await setup();

      const [byIdentity, byEmail] = await Promise.all([
        repository.findByAnyHash({ identityHash: lock.identityHash, emailHash: hash() }),
        repository.findByAnyHash({ identityHash: hash(), emailHash: lock.emailHash })
      ]);

      expect([byIdentity?.id, byEmail?.id]).toEqual([lock.id, lock.id]);
    });

    it("finds nothing for hashes no lock was remembered under", async () => {
      const { repository } = await setup();

      await expect(repository.findByAnyHash({ identityHash: hash(), emailHash: hash() })).resolves.toBeUndefined();
    });

    it("finds nothing without a hash to match, while locks are on record", async () => {
      const { repository } = await setup();

      await expect(repository.findByAnyHash({ identityHash: null, emailHash: null })).resolves.toBeUndefined();
    });
  });

  function hash() {
    return faker.string.hexadecimal({ length: 64, casing: "lower", prefix: "" });
  }

  async function setup() {
    const repository = container.resolve(DeletedAccountAbuseLockRepository);
    const lock = await repository.create({ identityHash: hash(), emailHash: hash(), reason: ABUSE_LOCK_REASON });

    return { repository, lock: { ...lock, identityHash: lock.identityHash!, emailHash: lock.emailHash! } };
  }
});
