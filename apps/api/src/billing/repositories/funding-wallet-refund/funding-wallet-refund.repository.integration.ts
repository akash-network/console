import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { FundingWalletRepository } from "@src/billing/repositories/funding-wallet/funding-wallet.repository";
import { FundingWalletMoveRepository } from "@src/billing/repositories/funding-wallet-move/funding-wallet-move.repository";
import { FundingWalletRefundRepository } from "./funding-wallet-refund.repository";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

describe(FundingWalletRefundRepository.name, () => {
  describe("recordUnlessKnown", () => {
    it("records returned escrow as still to be credited", async () => {
      const { repository, moveId, returned } = await setup();

      await repository.recordUnlessKnown(returned());

      await expect(repository.findByMove(moveId)).resolves.toEqual([expect.objectContaining({ ...returned(), status: "pending", failure: null })]);
    });

    it("leaves a close message it already holds as it is, whatever amount it is given again", async () => {
      const { repository, moveId, returned } = await setup();
      await repository.recordUnlessKnown(returned());
      const [recorded] = await repository.findByMove(moveId);
      await repository.updateFrom(recorded.id, "pending", { status: "credited" });

      await repository.recordUnlessKnown(returned({ amount: 1 }));

      await expect(repository.findByMove(moveId)).resolves.toEqual([expect.objectContaining({ id: recorded.id, amount: 500_000, status: "credited" })]);
    });

    it("keeps another message of the same transaction, and the same message under another move, apart", async () => {
      const { repository, moveId, otherMoveId, returned } = await setup();

      await repository.recordUnlessKnown(returned());
      await repository.recordUnlessKnown(returned({ msgIndex: 1 }));
      await repository.recordUnlessKnown(returned({ moveId: otherMoveId }));

      await expect(repository.findByMove(moveId)).resolves.toHaveLength(2);
      await expect(repository.findByMove(otherMoveId)).resolves.toHaveLength(1);
    });
  });

  describe("updateFrom", () => {
    it("changes a refund that is in the expected state and returns it", async () => {
      const { repository, moveId, returned } = await setup();
      await repository.recordUnlessKnown(returned());
      const [recorded] = await repository.findByMove(moveId);

      const updated = await repository.updateFrom(recorded.id, "pending", { status: "failed", failure: "interrupted" });

      expect(updated).toMatchObject({ id: recorded.id, status: "failed", failure: "interrupted", amount: 500_000 });
    });

    it("changes nothing and returns nothing when the refund has left the expected state", async () => {
      const { repository, moveId, returned } = await setup();
      await repository.recordUnlessKnown(returned());
      const [recorded] = await repository.findByMove(moveId);

      await expect(repository.updateFrom(recorded.id, "crediting", { status: "credited" })).resolves.toBeUndefined();

      await expect(repository.findByMove(moveId)).resolves.toEqual([recorded]);
    });

    it("lets only one of several runs take the same refund", async () => {
      const { repository, moveId, returned } = await setup();
      await repository.recordUnlessKnown(returned());
      const [recorded] = await repository.findByMove(moveId);

      const taken = await Promise.all([1, 2, 3, 4].map(() => repository.updateFrom(recorded.id, "pending", { status: "crediting" })));

      expect(taken.filter(Boolean)).toHaveLength(1);
    });

    it("changes only the refund it is asked for", async () => {
      const { repository, moveId, returned } = await setup();
      await repository.recordUnlessKnown(returned());
      await repository.recordUnlessKnown(returned({ msgIndex: 1 }));
      const [first] = await repository.findByMove(moveId);

      await repository.updateFrom(first.id, "pending", { status: "credited" });

      expect((await repository.findByMove(moveId)).map(refund => refund.status)).toEqual(["credited", "pending"]);
    });
  });

  async function setup() {
    const network = `net-${faker.string.alphanumeric(12)}`;
    const fundingWallets = container.resolve(FundingWalletRepository);
    const moves = container.resolve(FundingWalletMoveRepository);
    const from = await fundingWallets.create({ network, address: createAkashAddress(), status: "draining" });
    const to = await fundingWallets.create({ network, address: createAkashAddress(), status: "active" });
    const [move, otherMove] = await Promise.all(
      [1, 2].map(offset =>
        moves.createUnlessStarted({
          userWalletId: faker.number.int({ min: 1, max: 900_000 }) + offset,
          network,
          fromFundingWalletId: from.id,
          toFundingWalletId: to.id,
          status: "completed",
          readLimit: 0,
          readHeight: 100,
          feeLimit: 0,
          feeExpiresAt: null
        })
      )
    );
    const txHash = faker.string.hexadecimal({ length: 64, prefix: "" }).toUpperCase();

    return {
      repository: container.resolve(FundingWalletRefundRepository),
      moveId: move.id,
      otherMoveId: otherMove.id,
      returned: (overrides: { moveId?: string; msgIndex?: number; amount?: number } = {}) => ({
        moveId: move.id,
        txHash,
        msgIndex: 0,
        amount: 500_000,
        ...overrides
      })
    };
  }
});
