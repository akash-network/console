import { MsgCreateBid, MsgCreateLease } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { CHAIN_DB } from "@src/chain";
import { MessageRepository } from "./message.repository";

import { createAkashAddress, createAkashBlock, createAkashMessage, createTransaction } from "@test/seeders";

const BID_TYPE = `/${MsgCreateBid.$type}`;
const LEASE_TYPE = `/${MsgCreateLease.$type}`;
const SEND_TYPE = "/cosmos.bank.v1beta1.MsgSend";

describe(MessageRepository.name, () => {
  describe("getDeploymentRelatedMessages", () => {
    it("returns related messages with their tx hash, block datetime and type", async () => {
      const { repository, base, deploymentId } = setup();
      const datetime = new Date("2024-01-01T00:00:00.000Z");
      await createAkashBlock({ height: base, datetime });
      const { transaction } = await seedMessage({ deploymentId, type: SEND_TYPE, height: base });

      const messages = await repository.getDeploymentRelatedMessages(deploymentId);

      expect(messages).toEqual([{ txHash: transaction.hash, date: datetime, type: SEND_TYPE }]);
    });

    it("only returns messages belonging to the given deployment", async () => {
      const { repository, base, deploymentId } = setup();
      await createAkashBlock({ height: base });
      await seedMessage({ deploymentId, type: SEND_TYPE, height: base });
      await seedMessage({ deploymentId: faker.string.uuid(), type: SEND_TYPE, height: base });

      const messages = await repository.getDeploymentRelatedMessages(deploymentId);

      expect(messages).toHaveLength(1);
    });

    it("excludes v1beta1 and v1beta2 MsgWithdrawLease messages", async () => {
      const { repository, base, deploymentId } = setup();
      await createAkashBlock({ height: base });
      await seedMessage({ deploymentId, type: "/akash.market.v1beta1.MsgWithdrawLease", height: base });
      await seedMessage({ deploymentId, type: "/akash.market.v1beta2.MsgWithdrawLease", height: base });
      const { transaction } = await seedMessage({ deploymentId, type: SEND_TYPE, height: base });

      const messages = await repository.getDeploymentRelatedMessages(deploymentId);

      expect(messages).toEqual([expect.objectContaining({ txHash: transaction.hash, type: SEND_TYPE })]);
    });

    it("includes a bid only when a lease accepts it", async () => {
      const { repository, base, deploymentId } = setup();
      await createAkashBlock({ height: base });
      const bidId = { owner: createAkashAddress(), dseq: 100, gseq: 1, oseq: 2, bseq: 1, provider: createAkashAddress() };
      const { transaction: bidTx } = await seedMessage({ deploymentId, type: BID_TYPE, height: base, data: encodeBid(bidId) });
      await seedMessage({ deploymentId, type: LEASE_TYPE, height: base, data: encodeLease(bidId) });

      const messages = await repository.getDeploymentRelatedMessages(deploymentId);

      expect(messages).toEqual(
        expect.arrayContaining([expect.objectContaining({ txHash: bidTx.hash, type: BID_TYPE }), expect.objectContaining({ type: LEASE_TYPE })])
      );
    });

    it("excludes a bid that no lease accepts", async () => {
      const { repository, base, deploymentId } = setup();
      await createAkashBlock({ height: base });
      const acceptedBid = { owner: createAkashAddress(), dseq: 100, gseq: 1, oseq: 1, bseq: 1, provider: createAkashAddress() };
      const rejectedBid = { ...acceptedBid, provider: createAkashAddress() };
      const { transaction: acceptedTx } = await seedMessage({ deploymentId, type: BID_TYPE, height: base, data: encodeBid(acceptedBid) });
      const { transaction: rejectedTx } = await seedMessage({ deploymentId, type: BID_TYPE, height: base, data: encodeBid(rejectedBid) });
      await seedMessage({ deploymentId, type: LEASE_TYPE, height: base, data: encodeLease(acceptedBid) });

      const messages = await repository.getDeploymentRelatedMessages(deploymentId);

      const bidHashes = messages.filter(m => m.type === BID_TYPE).map(m => m.txHash);
      expect(bidHashes).toEqual([acceptedTx.hash]);
      expect(bidHashes).not.toContain(rejectedTx.hash);
    });

    it("sorts messages by block height descending", async () => {
      const { repository, base, deploymentId } = setup();
      await createAkashBlock({ height: base });
      await createAkashBlock({ height: base + 1 });
      await createAkashBlock({ height: base + 2 });
      const { transaction: lowest } = await seedMessage({ deploymentId, type: SEND_TYPE, height: base });
      const { transaction: highest } = await seedMessage({ deploymentId, type: SEND_TYPE, height: base + 2 });
      const { transaction: middle } = await seedMessage({ deploymentId, type: SEND_TYPE, height: base + 1 });

      const messages = await repository.getDeploymentRelatedMessages(deploymentId);

      expect(messages.map(m => m.txHash)).toEqual([highest.hash, middle.hash, lowest.hash]);
    });

    it("returns an empty list when the deployment has no related messages", async () => {
      const { repository, deploymentId } = setup();

      const messages = await repository.getDeploymentRelatedMessages(deploymentId);

      expect(messages).toEqual([]);
    });
  });

  let testBand = 0;

  function setup() {
    // Resolve CHAIN_DB so the chain Sequelize instance (and its models) is initialized — the
    // repository uses the static Message/Block/Transaction models directly and does not inject
    // the connection itself.
    container.resolve(CHAIN_DB);
    const repository = container.resolve(MessageRepository);
    testBand += 1;
    // Each test owns a disjoint height band so block heights (a primary key) never collide across
    // tests sharing the per-file database.
    const base = 2_000_000 + testBand * 10_000;
    return { repository, base, deploymentId: faker.string.uuid() };
  }

  async function seedMessage(input: { deploymentId: string; type: string; height: number; data?: Buffer }) {
    const transaction = await createTransaction({ height: input.height });
    const message = await createAkashMessage({
      type: input.type,
      txId: transaction.id,
      height: input.height,
      relatedDeploymentId: input.deploymentId,
      data: input.data
    });
    return { message, transaction };
  }

  function encodeBid(id: { owner: string; dseq: number; gseq: number; oseq: number; bseq: number; provider: string }) {
    return Buffer.from(MsgCreateBid.encode(MsgCreateBid.fromPartial({ id })).finish());
  }

  function encodeLease(bidId: { owner: string; dseq: number; gseq: number; oseq: number; bseq: number; provider: string }) {
    return Buffer.from(MsgCreateLease.encode(MsgCreateLease.fromPartial({ bidId })).finish());
  }
});
