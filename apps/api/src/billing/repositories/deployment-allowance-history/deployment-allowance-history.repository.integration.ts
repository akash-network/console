import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { CHAIN_DB } from "@src/chain";
import { DeploymentAllowanceHistoryRepository } from "./deployment-allowance-history.repository";

import { createAkashAddress } from "@test/seeders";
import { ensureTransactionEventTables, indexGrantRefund, indexRefundLeftWithGranter } from "@test/seeders/deployment-allowance-history.seeder";

const DENOM = "uact";

describe(DeploymentAllowanceHistoryRepository.name, () => {
  describe("findRefundsLeftWithGranter", () => {
    it("finds the escrow each closing deployment of the owner returned to the granter without a grant taking it back, oldest first", async () => {
      const { repository, granter, owner, readHeight } = await setup();
      const later = await indexRefundLeftWithGranter({ granter, owner, denom: DENOM, amount: 700_000, height: readHeight + 9 });
      const earlier = await indexRefundLeftWithGranter({ granter, owner, denom: DENOM, amount: 500_000, height: readHeight + 3 });

      const refunds = await repository.findRefundsLeftWithGranter({ granter, owner, afterHeight: readHeight });

      expect(refunds).toEqual([
        { txHash: earlier.txHash, height: readHeight + 3, msgIndex: 0, dseq: earlier.dseq, receivedByGranter: [`500000${DENOM}`] },
        { txHash: later.txHash, height: readHeight + 9, msgIndex: 0, dseq: later.dseq, receivedByGranter: [`700000${DENOM}`] }
      ]);
    });

    it("leaves out a close whose refund the grant took back", async () => {
      const { repository, granter, owner, readHeight } = await setup();
      await indexRefundLeftWithGranter({ granter, owner, denom: DENOM, amount: 500_000, height: readHeight + 3, isGrantSavedAgain: true });

      await expect(repository.findRefundsLeftWithGranter({ granter, owner, afterHeight: readHeight })).resolves.toEqual([]);
    });

    it("leaves out a close at or before the height it reads after", async () => {
      const { repository, granter, owner, readHeight } = await setup();
      await indexRefundLeftWithGranter({ granter, owner, denom: DENOM, amount: 500_000, height: readHeight });
      const after = await indexRefundLeftWithGranter({ granter, owner, denom: DENOM, amount: 600_000, height: readHeight + 1 });

      const refunds = await repository.findRefundsLeftWithGranter({ granter, owner, afterHeight: readHeight });

      expect(refunds.map(refund => refund.txHash)).toEqual([after.txHash]);
    });

    it("leaves out a close that failed on chain", async () => {
      const { repository, granter, owner, readHeight } = await setup();
      await indexRefundLeftWithGranter({ granter, owner, denom: DENOM, amount: 500_000, height: readHeight + 3, hasProcessingError: true });

      await expect(repository.findRefundsLeftWithGranter({ granter, owner, afterHeight: readHeight })).resolves.toEqual([]);
    });

    it("leaves out the closes of another owner and the refunds that went to another granter", async () => {
      const { repository, granter, owner, readHeight } = await setup();
      await indexRefundLeftWithGranter({ granter, owner: createAkashAddress(), denom: DENOM, amount: 500_000, height: readHeight + 3 });
      await indexRefundLeftWithGranter({ granter: createAkashAddress(), owner, denom: DENOM, amount: 500_000, height: readHeight + 4 });

      await expect(repository.findRefundsLeftWithGranter({ granter, owner, afterHeight: readHeight })).resolves.toEqual([]);
    });

    it("leaves out a close the indexer tied to no deployment of the owner", async () => {
      const { repository, granter, owner, readHeight } = await setup();
      await indexGrantRefund({ granter, grantee: owner, denom: DENOM, amount: 500_000, height: readHeight + 3 });

      await expect(repository.findRefundsLeftWithGranter({ granter, owner, afterHeight: readHeight })).resolves.toEqual([]);
    });
  });

  async function setup() {
    container.resolve(CHAIN_DB);
    await ensureTransactionEventTables();

    return {
      repository: container.resolve(DeploymentAllowanceHistoryRepository),
      granter: createAkashAddress(),
      owner: createAkashAddress(),
      readHeight: faker.number.int({ min: 50_000_000, max: 2_000_000_000 })
    };
  }
});
