import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { FundingWalletRepository } from "@src/billing/repositories/funding-wallet/funding-wallet.repository";
import { type FundingWalletMoveInput, FundingWalletMoveRepository } from "./funding-wallet-move.repository";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

describe(FundingWalletMoveRepository.name, () => {
  describe("createUnlessStarted", () => {
    it("saves a move with the read it was started from", async () => {
      const { repository, moveInput } = await setup();
      const input = moveInput({ readLimit: 5_000_000, readHeight: 1234, feeLimit: 700_000, feeExpiresAt: new Date("2030-01-01T00:00:00.000Z") });

      const move = await repository.createUnlessStarted(input);

      expect(move).toMatchObject({ ...input, id: expect.any(String), revokeSentAt: null, revokeTxHash: null, failure: null, claimedUntil: null });
    });

    it("returns the move a user wallet already has for that source wallet, with the read it saved first", async () => {
      const { repository, moveInput } = await setup();
      const first = await repository.createUnlessStarted(moveInput({ readLimit: 5_000_000 }));

      const second = await repository.createUnlessStarted(moveInput({ readLimit: 1 }));

      expect(second).toEqual(first);
    });

    it("keeps a larger balance than a 32-bit number holds", async () => {
      const { repository, moveInput } = await setup();

      const move = await repository.createUnlessStarted(moveInput({ readLimit: 9_000_000_000_000, readHeight: 3_000_000_000 }));

      expect(move).toMatchObject({ readLimit: 9_000_000_000_000, readHeight: 3_000_000_000 });
    });
  });

  describe("findBySource", () => {
    it("finds the move of that user wallet off that source wallet on that network only", async () => {
      const { repository, moveInput } = await setup();
      const input = moveInput();
      const move = await repository.createUnlessStarted(input);

      await expect(repository.findBySource(input)).resolves.toEqual(move);
      await expect(repository.findBySource({ ...input, userWalletId: input.userWalletId + 1 })).resolves.toBeUndefined();
      await expect(repository.findBySource({ ...input, network: "other" })).resolves.toBeUndefined();
      await expect(repository.findBySource({ ...input, fromFundingWalletId: input.toFundingWalletId })).resolves.toBeUndefined();
    });
  });

  describe("updateFrom", () => {
    it("changes the given fields of one move that is in the expected state and returns it", async () => {
      const { repository, moveInput } = await setup();
      const move = await repository.createUnlessStarted(moveInput());
      const untouched = await repository.createUnlessStarted(moveInput({ userWalletId: move.userWalletId + 1 }));
      const revokeSentAt = new Date("2026-11-27T12:00:00.000Z");

      const updated = await repository.updateFrom(move.id, "revoking", { status: "revoked", revokeTxHash: "AB".repeat(32), revokeSentAt });

      expect(updated).toMatchObject({ id: move.id, status: "revoked", revokeTxHash: "AB".repeat(32), revokeSentAt, readLimit: move.readLimit });
      await expect(repository.findBySource(untouched)).resolves.toEqual(untouched);
    });

    it("changes nothing and returns nothing when the move has left the expected state", async () => {
      const { repository, moveInput } = await setup();
      const move = await repository.createUnlessStarted(moveInput({ status: "completed" }));

      await expect(repository.updateFrom(move.id, "crediting", { status: "revoked" })).resolves.toBeUndefined();

      await expect(repository.findBySource(move)).resolves.toEqual(move);
    });

    it("lets only one of two runs take the same step", async () => {
      const { repository, moveInput } = await setup();
      const move = await repository.createUnlessStarted(moveInput({ status: "revoked" }));

      const steps = await Promise.all([1, 2, 3, 4].map(() => repository.updateFrom(move.id, "revoked", { status: "crediting" })));

      expect(steps.filter(Boolean)).toHaveLength(1);
    });
  });

  describe("claim", () => {
    it("gives a free move to the run that asks, with its current state", async () => {
      const { repository, moveInput } = await setup();
      const move = await repository.createUnlessStarted(moveInput({ status: "revoked" }));

      const claimed = await repository.claim(move.id, 600);

      expect(claimed).toMatchObject({ id: move.id, status: "revoked" });
      expect(claimed!.claimedUntil!.getTime() - Date.now()).toBeGreaterThan(540_000);
      expect(claimed!.claimedUntil!.getTime() - Date.now()).toBeLessThan(660_000);
    });

    it("refuses a move another run holds, and leaves that claim as it is", async () => {
      const { repository, moveInput } = await setup();
      const move = await repository.createUnlessStarted(moveInput());
      const held = await repository.claim(move.id, 600);

      await expect(repository.claim(move.id, 6000)).resolves.toBeUndefined();

      await expect(repository.findBySource(move)).resolves.toMatchObject({ claimedUntil: held!.claimedUntil });
    });

    it("gives a move to one of several runs asking at once", async () => {
      const { repository, moveInput } = await setup();
      const move = await repository.createUnlessStarted(moveInput());

      const claims = await Promise.all([1, 2, 3, 4].map(() => repository.claim(move.id, 600)));

      expect(claims.filter(Boolean)).toHaveLength(1);
    });

    it("gives a move whose claim has lapsed to the next run", async () => {
      const { repository, moveInput } = await setup();
      const move = await repository.createUnlessStarted(moveInput());
      await repository.claim(move.id, -1);

      await expect(repository.claim(move.id, 600)).resolves.toMatchObject({ id: move.id });
    });

    it("claims only the move it is asked for", async () => {
      const { repository, moveInput } = await setup();
      const move = await repository.createUnlessStarted(moveInput());
      const other = await repository.createUnlessStarted(moveInput({ userWalletId: move.userWalletId + 1 }));

      await repository.claim(move.id, 600);

      await expect(repository.findBySource(other)).resolves.toMatchObject({ claimedUntil: null });
    });
  });

  describe("release", () => {
    it("frees a held move for the next run and leaves other claims alone", async () => {
      const { repository, moveInput } = await setup();
      const move = await repository.createUnlessStarted(moveInput());
      const other = await repository.createUnlessStarted(moveInput({ userWalletId: move.userWalletId + 1 }));
      const held = await repository.claim(move.id, 600);
      await repository.claim(other.id, 600);

      await repository.release(move.id, held!.claimedUntil);

      await expect(repository.claim(move.id, 600)).resolves.toMatchObject({ id: move.id });
      await expect(repository.claim(other.id, 600)).resolves.toBeUndefined();
    });

    it("leaves the claim another run took after this one lapsed", async () => {
      const { repository, moveInput } = await setup();
      const move = await repository.createUnlessStarted(moveInput());
      const lapsed = await repository.claim(move.id, -1);
      const current = await repository.claim(move.id, 600);

      await repository.release(move.id, lapsed!.claimedUntil);

      await expect(repository.findBySource(move)).resolves.toMatchObject({ claimedUntil: current!.claimedUntil });
      await expect(repository.claim(move.id, 600)).resolves.toBeUndefined();
    });

    it("leaves a move with the same claim end alone when it is not the one named", async () => {
      const { repository, moveInput } = await setup();
      const move = await repository.createUnlessStarted(moveInput());
      const other = await repository.createUnlessStarted(moveInput({ userWalletId: move.userWalletId + 1 }));
      const held = await repository.claim(move.id, 600);

      await repository.release(other.id, held!.claimedUntil);

      await expect(repository.claim(move.id, 600)).resolves.toBeUndefined();
    });
  });

  describe("findCompletedOf", () => {
    it("finds the completed moves of a user wallet on a network with the address of the funding wallet each one left", async () => {
      const { repository, moveInput, from, otherSource, network } = await setup();
      const completed = await repository.createUnlessStarted(moveInput({ status: "completed" }));
      const earlier = await repository.createUnlessStarted(moveInput({ status: "completed", fromFundingWalletId: otherSource.id }));
      await repository.createUnlessStarted(moveInput({ status: "completed", userWalletId: completed.userWalletId + 1 }));

      const moves = await repository.findCompletedOf(completed.userWalletId, network);

      expect(moves).toEqual([
        { ...completed, fromAddress: from.address },
        { ...earlier, fromAddress: otherSource.address }
      ]);
      await expect(repository.findCompletedOf(completed.userWalletId, "other")).resolves.toEqual([]);
    });

    it.each(["revoking", "revoked", "crediting", "failed"] as const)("leaves out a move that is %s", async status => {
      const { repository, moveInput, network } = await setup();
      const move = await repository.createUnlessStarted(moveInput({ status }));

      await expect(repository.findCompletedOf(move.userWalletId, network)).resolves.toEqual([]);
    });
  });

  describe("countByStatus", () => {
    it("counts the moves off one source wallet by state", async () => {
      const { repository, moveInput, otherSource } = await setup();
      const [first, second] = await Promise.all([1, 2, 3].map(offset => repository.createUnlessStarted(moveInput({ userWalletId: 1000 + offset }))));
      await repository.updateFrom(first.id, "revoking", { status: "completed" });
      await repository.updateFrom(second.id, "revoking", { status: "completed" });
      await repository.createUnlessStarted(moveInput({ fromFundingWalletId: otherSource.id, status: "failed" }));

      await expect(repository.countByStatus(first.fromFundingWalletId)).resolves.toEqual({ completed: 2, revoking: 1 });
    });

    it("counts nothing for a wallet no user was moved off", async () => {
      const { repository } = await setup();

      await expect(repository.countByStatus(faker.string.uuid())).resolves.toEqual({});
    });
  });

  describe("findUserWalletIdsByStatus", () => {
    it("lists in order the user wallets whose move off one source wallet is in one of the given states", async () => {
      const { repository, moveInput, from, otherSource } = await setup();
      await repository.createUnlessStarted(moveInput({ userWalletId: 2002, status: "revoked" }));
      await repository.createUnlessStarted(moveInput({ userWalletId: 2001, status: "revoking" }));
      await repository.createUnlessStarted(moveInput({ userWalletId: 2003, status: "completed" }));
      await repository.createUnlessStarted(moveInput({ userWalletId: 2010, fromFundingWalletId: otherSource.id, status: "revoked" }));

      await expect(repository.findUserWalletIdsByStatus(from.id, ["revoking", "revoked"])).resolves.toEqual([2001, 2002]);
    });

    it("finds nothing for a wallet no user was moved off", async () => {
      const { repository } = await setup();

      await expect(repository.findUserWalletIdsByStatus(faker.string.uuid(), ["revoking"])).resolves.toEqual([]);
    });
  });

  async function setup() {
    const network = `net-${faker.string.alphanumeric(12)}`;
    const fundingWallets = container.resolve(FundingWalletRepository);
    const [from, to, otherSource] = await Promise.all(
      (["draining", "active", "retired"] as const).map(status => fundingWallets.create({ network, address: createAkashAddress(), status }))
    );
    const moveInput = (overrides: Partial<FundingWalletMoveInput> = {}): FundingWalletMoveInput => ({
      userWalletId: faker.number.int({ min: 1, max: 900 }),
      network,
      fromFundingWalletId: from.id,
      toFundingWalletId: to.id,
      status: "revoking",
      readLimit: 1_000_000,
      readHeight: 100,
      feeLimit: 0,
      feeExpiresAt: null,
      ...overrides
    });
    const userWalletId = faker.number.int({ min: 1, max: 900 });

    return {
      repository: container.resolve(FundingWalletMoveRepository),
      moveInput: (overrides: Partial<FundingWalletMoveInput> = {}) => moveInput({ userWalletId, ...overrides }),
      from,
      network,
      otherSource
    };
  }
});
