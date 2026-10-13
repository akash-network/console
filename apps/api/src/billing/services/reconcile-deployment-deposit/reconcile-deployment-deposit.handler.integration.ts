import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DeploymentSpendRepository } from "@src/billing/repositories/deployment-spend/deployment-spend.repository";
import { CHAIN_DB } from "@src/chain";
import { TxPresenceService } from "@src/chain/services/tx-presence/tx-presence.service";
import { JOB_NAME, JobQueueService } from "@src/core";
import { ReconcileDeploymentDeposit, ReconcileDeploymentDepositHandler } from "./reconcile-deployment-deposit.handler";

import { createAkashAddress, createAkashBlock, createAkashMessage, createDeployment, createTransaction } from "@test/seeders";
import { findDeploymentDeposit, seedDeploymentDeposit } from "@test/seeders/db/deployment-deposit.seeder";
import { seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const jobWorkers = useJobWorkers(() => [container.resolve(ReconcileDeploymentDepositHandler)]);

const RETRIES_LEFT = { retryCount: 2, retryLimit: 5 };
const LAST_ATTEMPT = { retryCount: 5, retryLimit: 5 };

describe(ReconcileDeploymentDepositHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("for a transaction with a hash", () => {
    it("confirms the pending deposits of a transaction that landed, run the way a worker runs it", async () => {
      const { txHash, pending, alreadyVoid, otherTransaction, answerChainWith, runJob } = await setupHash();
      answerChainWith({ code: 0 });

      await runJob();

      expect(await findDeploymentDeposit(pending.id)).toMatchObject({ status: "confirmed", txHash });
      expect(await findDeploymentDeposit(alreadyVoid.id)).toMatchObject({ status: "void" });
      expect(await findDeploymentDeposit(otherTransaction.id)).toMatchObject({ status: "pending" });
    });

    it("voids the pending deposits of a transaction the chain refused", async () => {
      const { pending, answerChainWith, runJob } = await setupHash();
      answerChainWith({ code: 11 });

      await runJob();

      expect(await findDeploymentDeposit(pending.id)).toMatchObject({ status: "void" });
    });

    it("asks again while retries remain when the chain has not seen the transaction", async () => {
      const { txHash, pending, handler, answerChainWith } = await setupHash();
      answerChainWith(null);

      await expect(handler.handle({ txHash, version: 1 }, { id: faker.string.uuid(), ...RETRIES_LEFT })).rejects.toThrow(txHash);

      expect(await findDeploymentDeposit(pending.id)).toMatchObject({ status: "pending" });
    });

    it("voids the deposits once the last attempt still finds no transaction", async () => {
      const { txHash, pending, handler, answerChainWith } = await setupHash();
      answerChainWith(null);

      await handler.handle({ txHash, version: 1 }, { id: faker.string.uuid(), ...LAST_ATTEMPT });

      expect(await findDeploymentDeposit(pending.id)).toMatchObject({ status: "void" });
    });
  });

  describe("for deposits the signer gave no hash for", () => {
    it("confirms a create and a top-up the chain index holds, run the way a worker runs it", async () => {
      const { organization, owner, recordedAt } = await setupIndex();
      const create = await seedPending({ organizationId: organization.id, owner, kind: "deployment_create", createdAt: recordedAt });
      const topUp = await seedPending({ organizationId: organization.id, owner, kind: "top_up", createdAt: recordedAt });
      await indexCreate({ owner, dseq: create.dseq, at: secondsAfter(recordedAt, 5) });
      const deployment = await indexCreate({ owner, dseq: topUp.dseq, at: secondsAfter(recordedAt, -86_400) });
      const txHash = await indexTopUp({ deploymentId: deployment.id, amount: topUp.amount, at: secondsAfter(recordedAt, 5) });

      const { enqueue, startWorkers } = await jobWorkers();
      const singletonKey = `${ReconcileDeploymentDeposit[JOB_NAME]}.${create.id}`;
      await enqueue(new ReconcileDeploymentDeposit({ depositIds: [create.id, topUp.id] }), { singletonKey });
      await startWorkers();
      await expectJobCompleted(ReconcileDeploymentDeposit[JOB_NAME], { singletonKey });

      expect(await findDeploymentDeposit(create.id)).toMatchObject({ status: "confirmed" });
      expect(await findDeploymentDeposit(topUp.id)).toMatchObject({ status: "confirmed", txHash });
    });

    it("lets one chain deposit back one row, voiding the other once the index has passed both", async () => {
      const { organization, owner, recordedAt, handler } = await setupIndex();
      const first = await seedPending({ organizationId: organization.id, owner, kind: "top_up", amountCents: 50, createdAt: recordedAt });
      const second = await seedPending({ organizationId: organization.id, owner, kind: "top_up", amountCents: 50, dseq: first.dseq, createdAt: recordedAt });
      const deployment = await indexCreate({ owner, dseq: first.dseq, at: secondsAfter(recordedAt, -86_400) });
      const txHash = await indexTopUp({ deploymentId: deployment.id, amount: first.amount, at: secondsAfter(recordedAt, 5) });
      await indexTip(secondsAfter(recordedAt, 3_600));

      await handler.handle({ depositIds: [first.id, second.id], version: 1 }, { id: faker.string.uuid(), ...LAST_ATTEMPT });

      expect(await findDeploymentDeposit(first.id)).toMatchObject({ status: "confirmed", txHash });
      expect(await findDeploymentDeposit(second.id)).toMatchObject({ status: "void" });
    });

    it("lets a deployment's one create back one row", async () => {
      const { organization, owner, recordedAt, handler } = await setupIndex();
      const first = await seedPending({ organizationId: organization.id, owner, kind: "deployment_create", createdAt: recordedAt });
      const retried = await seedPending({ organizationId: organization.id, owner, kind: "deployment_create", dseq: first.dseq, createdAt: recordedAt });
      await indexCreate({ owner, dseq: first.dseq, at: secondsAfter(recordedAt, 5) });
      await indexTip(secondsAfter(recordedAt, 3_600));

      await handler.handle({ depositIds: [first.id, retried.id], version: 1 }, { id: faker.string.uuid(), ...LAST_ATTEMPT });

      expect(await findDeploymentDeposit(first.id)).toMatchObject({ status: "confirmed" });
      expect(await findDeploymentDeposit(retried.id)).toMatchObject({ status: "void" });
    });

    it("lets one chain deposit back one row when two checks of the deployment run at once", async () => {
      const { organization, owner, recordedAt, handler } = await setupIndex();
      const first = await seedPending({ organizationId: organization.id, owner, kind: "top_up", amountCents: 50, createdAt: recordedAt });
      const second = await seedPending({ organizationId: organization.id, owner, kind: "top_up", amountCents: 50, dseq: first.dseq, createdAt: recordedAt });
      const deployment = await indexCreate({ owner, dseq: first.dseq, at: secondsAfter(recordedAt, -86_400) });
      await indexTopUp({ deploymentId: deployment.id, amount: first.amount, at: secondsAfter(recordedAt, 5) });
      await indexTip(secondsAfter(recordedAt, 3_600));
      letChainReadsOverlap();

      await Promise.all([first, second].map(({ id }) => handler.handle({ depositIds: [id], version: 1 }, { id: faker.string.uuid(), ...LAST_ATTEMPT })));

      const statuses = [(await findDeploymentDeposit(first.id)).status, (await findDeploymentDeposit(second.id)).status];
      expect(statuses.sort()).toEqual(["confirmed", "void"]);
    });

    it("leaves a chain top-up to the pending row that holds its hash", async () => {
      const { organization, owner, recordedAt, handler } = await setupIndex();
      const unhashed = await seedPending({ organizationId: organization.id, owner, kind: "top_up", amountCents: 50, createdAt: recordedAt });
      const deployment = await indexCreate({ owner, dseq: unhashed.dseq, at: secondsAfter(recordedAt, -86_400) });
      const txHash = await indexTopUp({ deploymentId: deployment.id, amount: unhashed.amount, at: secondsAfter(recordedAt, 5) });
      const hashed = await seedPending({
        organizationId: organization.id,
        owner,
        kind: "top_up",
        amountCents: 50,
        dseq: unhashed.dseq,
        txHash,
        createdAt: recordedAt
      });
      await indexTip(secondsAfter(recordedAt, 3_600));

      await handler.handle({ depositIds: [unhashed.id], version: 1 }, { id: faker.string.uuid(), ...LAST_ATTEMPT });

      expect(await findDeploymentDeposit(unhashed.id)).toMatchObject({ status: "void" });
      expect(await findDeploymentDeposit(hashed.id)).toMatchObject({ status: "pending", txHash });
    });

    it("leaves a deployment's create to the pending row that holds its hash", async () => {
      const { organization, owner, recordedAt, handler } = await setupIndex();
      const hashed = await seedPending({ organizationId: organization.id, owner, kind: "deployment_create", txHash: "A".repeat(64), createdAt: recordedAt });
      const unhashed = await seedPending({ organizationId: organization.id, owner, kind: "deployment_create", dseq: hashed.dseq, createdAt: recordedAt });
      await indexCreate({ owner, dseq: hashed.dseq, at: secondsAfter(recordedAt, 5) });
      await indexTip(secondsAfter(recordedAt, 3_600));

      await handler.handle({ depositIds: [unhashed.id], version: 1 }, { id: faker.string.uuid(), ...LAST_ATTEMPT });

      expect(await findDeploymentDeposit(unhashed.id)).toMatchObject({ status: "void" });
      expect(await findDeploymentDeposit(hashed.id)).toMatchObject({ status: "pending" });
    });

    it("does not count a deposit that landed after the signer could have sent this one", async () => {
      const { organization, owner, recordedAt, handler } = await setupIndex();
      const topUp = await seedPending({ organizationId: organization.id, owner, kind: "top_up", createdAt: recordedAt });
      const deployment = await indexCreate({ owner, dseq: topUp.dseq, at: secondsAfter(recordedAt, -86_400) });
      await indexTopUp({ deploymentId: deployment.id, amount: topUp.amount, at: secondsAfter(recordedAt, 1_800) });
      await indexTip(secondsAfter(recordedAt, 3_600));

      await handler.handle({ depositIds: [topUp.id], version: 1 }, { id: faker.string.uuid(), ...LAST_ATTEMPT });

      expect(await findDeploymentDeposit(topUp.id)).toMatchObject({ status: "void" });
    });

    it("asks again while retries remain when the index does not show the deposit", async () => {
      const { organization, owner, recordedAt, handler } = await setupIndex();
      const topUp = await seedPending({ organizationId: organization.id, owner, kind: "top_up", createdAt: recordedAt });

      await expect(handler.handle({ depositIds: [topUp.id], version: 1 }, { id: faker.string.uuid(), ...RETRIES_LEFT })).rejects.toThrow(topUp.id);

      expect(await findDeploymentDeposit(topUp.id)).toMatchObject({ status: "pending" });
    });

    it("waits for an index that has not reached the deposit's window, then voids it after the last wait", async () => {
      const { organization, owner, recordedAt, handler } = await setupIndex();
      const topUp = await seedPending({ organizationId: organization.id, owner, kind: "top_up", createdAt: recordedAt });
      await indexTip(secondsAfter(recordedAt, 30));

      await handler.handle({ depositIds: [topUp.id], version: 1 }, { id: faker.string.uuid(), ...LAST_ATTEMPT });

      expect(await findDeploymentDeposit(topUp.id)).toMatchObject({ status: "pending" });
      expect(await findJobRows(ReconcileDeploymentDeposit[JOB_NAME], { singletonKey: `${ReconcileDeploymentDeposit[JOB_NAME]}.${topUp.id}.1` })).toEqual([
        expect.objectContaining({ data: expect.objectContaining({ depositIds: [topUp.id], indexLagRetries: 1 }) })
      ]);

      await handler.handle({ depositIds: [topUp.id], indexLagRetries: 6, version: 1 }, { id: faker.string.uuid(), ...LAST_ATTEMPT });

      expect(await findDeploymentDeposit(topUp.id)).toMatchObject({ status: "void" });
    });

    it("voids the deposits when the wait for the index cannot be queued", async () => {
      const { organization, owner, recordedAt, handler } = await setupIndex();
      const topUp = await seedPending({ organizationId: organization.id, owner, kind: "top_up", createdAt: recordedAt });
      await indexTip(secondsAfter(recordedAt, 30));
      vi.spyOn(container.resolve(JobQueueService), "enqueue").mockRejectedValue(new Error("queue unavailable"));

      await handler.handle({ depositIds: [topUp.id], version: 1 }, { id: faker.string.uuid(), ...LAST_ATTEMPT });

      expect(await findDeploymentDeposit(topUp.id)).toMatchObject({ status: "void" });
    });
  });

  function letChainReadsOverlap() {
    const repository = container.resolve(DeploymentSpendRepository);
    const findTopUpTxHashes = repository.findTopUpTxHashes.bind(repository);
    let arrivals = 0;
    let releaseReaders = () => {};
    const bothRead = new Promise<void>(resolve => {
      releaseReaders = resolve;
    });

    vi.spyOn(repository, "findTopUpTxHashes").mockImplementation(async input => {
      const txHashes = await findTopUpTxHashes(input);
      arrivals += 1;
      if (arrivals === 2) releaseReaders();
      await Promise.race([bothRead, new Promise(resolve => setTimeout(resolve, 500))]);

      return txHashes;
    });
  }

  let tipHeight = 2_100_000_000;

  async function indexTip(at: Date) {
    container.resolve(CHAIN_DB);
    await createAkashBlock({ height: ++tipHeight, datetime: at });
  }

  function secondsAfter(at: Date, seconds: number) {
    return new Date(at.getTime() + seconds * 1000);
  }

  async function seedPending(input: Parameters<typeof seedDeploymentDeposit>[0]) {
    return await seedDeploymentDeposit({ status: "pending", ...input });
  }

  async function setupIndex() {
    await jobWorkers();
    const { organization } = await seedOrganizationWithOwner();

    return { organization, owner: createAkashAddress(), recordedAt: new Date(), handler: container.resolve(ReconcileDeploymentDepositHandler) };
  }

  async function indexCreate({ owner, dseq, at }: { owner: string; dseq: string; at: Date }) {
    container.resolve(CHAIN_DB);
    const height = uniqueHeight();
    await createAkashBlock({ height, datetime: at });

    return await createDeployment({ owner, dseq, createdHeight: height, deposit: 5_000_000, denom: "uact" });
  }

  async function indexTopUp({ deploymentId, amount, at }: { deploymentId: string; amount: string; at: Date }) {
    const height = uniqueHeight();
    const hash = faker.string.hexadecimal({ length: 64, prefix: "" }).toUpperCase();
    await createAkashBlock({ height, datetime: at });
    const transaction = await createTransaction({ height, hash });
    await createAkashMessage({ txId: transaction.id, height, type: "/akash.escrow.v1.MsgAccountDeposit", amount, relatedDeploymentId: deploymentId });

    return hash;
  }

  function uniqueHeight() {
    return faker.number.int({ min: 50_000_000, max: 2_000_000_000 });
  }

  async function setupHash() {
    const { organization } = await seedOrganizationWithOwner();
    const txHash = faker.string.hexadecimal({ length: 64, prefix: "" }).toUpperCase();
    const pending = await seedDeploymentDeposit({ organizationId: organization.id, status: "pending", txHash });
    const alreadyVoid = await seedDeploymentDeposit({ organizationId: organization.id, status: "void", txHash });
    const otherTransaction = await seedDeploymentDeposit({ organizationId: organization.id, status: "pending", txHash: `${txHash.slice(0, 60)}FFFF` });
    const handler = container.resolve(ReconcileDeploymentDepositHandler);

    const answerChainWith = (answer: { code: number } | null) =>
      vi.spyOn(container.resolve(TxPresenceService), "findTx").mockResolvedValue(answer && { hash: txHash, code: answer.code, height: 100, rawLog: "" });

    const runJob = async () => {
      const { enqueue, startWorkers } = await jobWorkers();
      const singletonKey = `${ReconcileDeploymentDeposit[JOB_NAME]}.${txHash}`;
      await enqueue(new ReconcileDeploymentDeposit({ txHash }), { singletonKey });
      await startWorkers();
      await expectJobCompleted(ReconcileDeploymentDeposit[JOB_NAME], { singletonKey });
    };

    return { txHash, pending, alreadyVoid, otherTransaction, handler, answerChainWith, runJob };
  }
});
