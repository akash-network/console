import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { type BalanceSnapshotGrant, BalanceSnapshotRepository } from "./balance-snapshot.repository";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

const TAKEN_ON = "2026-11-28";

describe(BalanceSnapshotRepository.name, () => {
  describe("startUnlessComplete", () => {
    it("starts the day's snapshot as running at the height given", async () => {
      const { repository, network } = setup();

      const snapshot = await repository.startUnlessComplete({ network, takenOn: TAKEN_ON, height: 100 });

      expect(snapshot).toMatchObject({ network, takenOn: TAKEN_ON, status: "running", height: 100, grantsCount: null, failure: null });
      await expect(repository.findByDay({ network, takenOn: TAKEN_ON })).resolves.toEqual(snapshot);
    });

    it("starts a failed day over at the new height, without the grants and the failure it had", async () => {
      const { repository, network, grant } = setup();
      const failed = await repository.startUnlessComplete({ network, takenOn: TAKEN_ON, height: 100 });
      await repository.addGrants(failed!.id, [grant()]);
      await repository.fail(failed!.id, "node has not reached this height");

      const restarted = await repository.startUnlessComplete({ network, takenOn: TAKEN_ON, height: 140 });

      expect(restarted).toMatchObject({ id: failed!.id, status: "running", height: 140, grantsCount: null, failure: null });
      await expect(repository.findGrants(failed!.id)).resolves.toEqual([]);
    });

    it("starts over a day left running by a run that died", async () => {
      const { repository, network, grant } = setup();
      const abandoned = await repository.startUnlessComplete({ network, takenOn: TAKEN_ON, height: 100 });
      await repository.addGrants(abandoned!.id, [grant()]);

      const restarted = await repository.startUnlessComplete({ network, takenOn: TAKEN_ON, height: 140 });

      expect(restarted).toMatchObject({ id: abandoned!.id, status: "running", height: 140 });
      await expect(repository.findGrants(abandoned!.id)).resolves.toEqual([]);
    });

    it("returns nothing for a complete day and leaves it and its grants as they are", async () => {
      const { repository, network, grant } = setup();
      const complete = await repository.startUnlessComplete({ network, takenOn: TAKEN_ON, height: 100 });
      const kept = grant();
      await repository.addGrants(complete!.id, [kept]);
      await repository.complete(complete!.id, 1);

      await expect(repository.startUnlessComplete({ network, takenOn: TAKEN_ON, height: 140 })).resolves.toBeUndefined();

      await expect(repository.findByDay({ network, takenOn: TAKEN_ON })).resolves.toMatchObject({ status: "complete", height: 100, grantsCount: 1 });
      await expect(repository.findGrants(complete!.id)).resolves.toEqual([kept]);
    });

    it("keeps one snapshot per network and day apart from the others", async () => {
      const { repository, network } = setup();
      const other = setup();
      const today = await repository.startUnlessComplete({ network, takenOn: TAKEN_ON, height: 100 });
      const tomorrow = await repository.startUnlessComplete({ network, takenOn: "2026-11-29", height: 200 });
      const elsewhere = await repository.startUnlessComplete({ network: other.network, takenOn: TAKEN_ON, height: 300 });

      expect(new Set([today!.id, tomorrow!.id, elsewhere!.id]).size).toBe(3);
      await expect(repository.findByDay({ network, takenOn: TAKEN_ON })).resolves.toMatchObject({ id: today!.id, height: 100 });
    });
  });

  describe("addGrants", () => {
    it("stores the grants under their snapshot only, and lists them by granter, grantee and denom", async () => {
      const { repository, network, grant } = setup();
      const snapshot = await repository.startUnlessComplete({ network, takenOn: TAKEN_ON, height: 100 });
      const other = await repository.startUnlessComplete({ network, takenOn: "2026-11-29", height: 200 });
      const [granter, grantee] = [createAkashAddress(), createAkashAddress()];
      const inUakt = grant({ granter, grantee, denom: "uakt", amount: 5 });
      const inUact = grant({ granter, grantee, denom: "uact", amount: 9_000_000_000_000 });
      await repository.addGrants(other!.id, [grant()]);

      await repository.addGrants(snapshot!.id, [inUakt, inUact]);
      await repository.addGrants(snapshot!.id, []);

      await expect(repository.findGrants(snapshot!.id)).resolves.toEqual([inUact, inUakt]);
    });
  });

  describe("fail", () => {
    it("marks the snapshot failed with the reason", async () => {
      const { repository, network } = setup();
      const snapshot = await repository.startUnlessComplete({ network, takenOn: TAKEN_ON, height: 100 });

      await repository.fail(snapshot!.id, "node has not reached this height");

      await expect(repository.findByDay({ network, takenOn: TAKEN_ON })).resolves.toMatchObject({
        status: "failed",
        failure: "node has not reached this height"
      });
    });
  });

  describe("findLatestComplete", () => {
    it("finds the most recent day of the network that is complete, whatever came after it", async () => {
      const { repository, network } = setup();
      const other = setup();
      const days = { older: "2026-11-25", latestComplete: "2026-11-26", failedSince: "2026-11-27", runningSince: "2026-11-28" };
      const [older, latestComplete, failedSince] = [
        await repository.startUnlessComplete({ network, takenOn: days.older, height: 100 }),
        await repository.startUnlessComplete({ network, takenOn: days.latestComplete, height: 200 }),
        await repository.startUnlessComplete({ network, takenOn: days.failedSince, height: 300 })
      ];
      await repository.startUnlessComplete({ network, takenOn: days.runningSince, height: 400 });
      const elsewhere = await repository.startUnlessComplete({ network: other.network, takenOn: days.runningSince, height: 500 });
      await repository.complete(older!.id, 0);
      await repository.complete(latestComplete!.id, 0);
      await repository.fail(failedSince!.id, "boom");
      await repository.complete(elsewhere!.id, 0);

      await expect(repository.findLatestComplete(network)).resolves.toMatchObject({ id: latestComplete!.id, takenOn: days.latestComplete, status: "complete" });
    });

    it("finds nothing for a network without a complete snapshot", async () => {
      const { repository, network } = setup();
      await repository.startUnlessComplete({ network, takenOn: TAKEN_ON, height: 100 });

      await expect(repository.findLatestComplete(network)).resolves.toBeUndefined();
    });
  });

  describe("findGrantsOf", () => {
    it("finds what one grantee held in one snapshot, from every granter and in every denom", async () => {
      const { repository, network, grant } = setup();
      const snapshot = await repository.startUnlessComplete({ network, takenOn: TAKEN_ON, height: 100 });
      const other = await repository.startUnlessComplete({ network, takenOn: "2026-11-29", height: 200 });
      const grantee = createAkashAddress();
      const held = [grant({ grantee, denom: "uact" }), grant({ grantee, denom: "uakt" })];
      await repository.addGrants(snapshot!.id, [...held, grant()]);
      await repository.addGrants(other!.id, [grant({ grantee })]);

      const found = await repository.findGrantsOf(snapshot!.id, grantee);

      expect(found).toHaveLength(2);
      expect(found).toEqual(expect.arrayContaining(held));
    });
  });

  it("finds no snapshot for a day none was started on", async () => {
    const { repository, network } = setup();

    await expect(repository.findByDay({ network, takenOn: TAKEN_ON })).resolves.toBeUndefined();
  });

  function setup() {
    const grant = (overrides: Partial<BalanceSnapshotGrant> = {}): BalanceSnapshotGrant => ({
      granter: createAkashAddress(),
      grantee: createAkashAddress(),
      denom: "uact",
      amount: faker.number.int({ min: 0, max: 5_000_000 }),
      ...overrides
    });

    return { repository: container.resolve(BalanceSnapshotRepository), network: `net-${faker.string.alphanumeric(12)}`, grant };
  }
});
