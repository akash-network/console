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

      expect(move).toMatchObject({ ...input, id: expect.any(String), revokeSentAt: null, revokeTxHash: null, failure: null });
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

  describe("update", () => {
    it("changes the given fields of one move and returns it", async () => {
      const { repository, moveInput } = await setup();
      const move = await repository.createUnlessStarted(moveInput());
      const untouched = await repository.createUnlessStarted(moveInput({ userWalletId: move.userWalletId + 1 }));
      const revokeSentAt = new Date("2026-11-27T12:00:00.000Z");

      const updated = await repository.update(move.id, { status: "revoked", revokeTxHash: "AB".repeat(32), revokeSentAt });

      expect(updated).toMatchObject({ id: move.id, status: "revoked", revokeTxHash: "AB".repeat(32), revokeSentAt, readLimit: move.readLimit });
      await expect(repository.findBySource(untouched)).resolves.toEqual(untouched);
    });
  });

  describe("countByStatus", () => {
    it("counts the moves off one source wallet by state", async () => {
      const { repository, moveInput, otherSource } = await setup();
      const [first, second] = await Promise.all([1, 2, 3].map(offset => repository.createUnlessStarted(moveInput({ userWalletId: 1000 + offset }))));
      await repository.update(first.id, { status: "completed" });
      await repository.update(second.id, { status: "completed" });
      await repository.createUnlessStarted(moveInput({ fromFundingWalletId: otherSource.id, status: "failed" }));

      await expect(repository.countByStatus(first.fromFundingWalletId)).resolves.toEqual({ completed: 2, revoking: 1 });
    });

    it("counts nothing for a wallet no user was moved off", async () => {
      const { repository } = await setup();

      await expect(repository.countByStatus(faker.string.uuid())).resolves.toEqual({});
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
      otherSource
    };
  }
});
