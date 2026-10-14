import { MsgAccountDeposit, Scope } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { MsgCloseDeployment, MsgCreateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type {
  DeploymentDepositInput,
  DeploymentDepositOutput,
  DeploymentDepositRepository
} from "@src/billing/repositories/deployment-deposit/deployment-deposit.repository";
import type { UserWalletRepository } from "@src/billing/repositories/user-wallet/user-wallet.repository";
import { TxNotIncludedError, TxOutcomeUnknownError } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";
import { ReconcileDeploymentDeposit } from "@src/billing/services/reconcile-deployment-deposit/reconcile-deployment-deposit.handler";
import type { DenomExchangeService } from "@src/chain/services/denom-exchange/denom-exchange.service";
import type { CreateLogger, JobQueueService } from "@src/core";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { TxService } from "@src/core/services/tx/tx.service";
import type { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { ProjectOutput, ProjectRepository } from "@src/organization/repositories/project/project.repository";
import type { OrganizationContext } from "@src/organization/types/organization-context";
import type { UserOutput } from "@src/user/repositories";
import { DeploymentDepositLedgerService, type PendingDeposits } from "./deployment-deposit-ledger.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createUser } from "@test/seeders/user.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

describe(DeploymentDepositLedgerService.name, () => {
  describe("recordPending", () => {
    it("records nothing and reads no wallet when no message moves funds", async () => {
      const { service, userWalletRepository, deploymentDepositRepository } = setup();

      const pending = await service.recordPending(1, [closeMessage("1")]);

      expect(pending).toEqual({ recorded: [], awaitingPrice: [] });
      expect(userWalletRepository.findById).not.toHaveBeenCalled();
      expect(deploymentDepositRepository.createMany).not.toHaveBeenCalled();
    });

    it("records a create pending in the project its deployment record is filed in, priced in cents", async () => {
      const { service, wallet, deploymentDepositRepository, deploymentSettingRepository, currentUser } = setup();
      const projectId = faker.string.uuid();
      deploymentSettingRepository.findProjectIdsInOrganizationByDseqs.mockResolvedValue(new Map([["101", projectId]]));

      const pending = await service.recordPending(wallet.id, [createMessage({ owner: wallet.address!, dseq: "101", amount: "5000000", denom: "uact" })]);

      const row = {
        kind: "deployment_create",
        owner: wallet.address,
        dseq: "101",
        amount: "5000000",
        denom: "uact",
        amountCents: 500,
        organizationId: wallet.organizationId,
        projectId,
        actorUserId: currentUser.id,
        createdAt: expect.any(Date)
      };
      expect(deploymentSettingRepository.findProjectIdsInOrganizationByDseqs).toHaveBeenCalledWith(wallet.organizationId, ["101"]);
      expect(deploymentDepositRepository.createMany).toHaveBeenCalledWith([row]);
      expect(pending).toEqual({ recorded: [row], awaitingPrice: [] });
    });

    it("files a create not yet recorded into the project its caller signs it for", async () => {
      const { service, wallet, deploymentDepositRepository, projectRepository } = setup();
      const filingProjectId = faker.string.uuid();

      await service.recordPending(wallet.id, [createMessage({ owner: wallet.address!, dseq: "102" })], { filingProjectId });

      expect(projectRepository.findDefaultByOrganizationId).not.toHaveBeenCalled();
      expect(deploymentDepositRepository.createMany).toHaveBeenCalledWith([expect.objectContaining({ projectId: filingProjectId })]);
    });

    it("files a create not yet recorded and signed for no project into the organization's default project", async () => {
      const { service, wallet, deploymentDepositRepository, projectRepository } = setup();
      const defaultProject = mock<ProjectOutput>({ id: faker.string.uuid() });
      projectRepository.findDefaultByOrganizationId.mockResolvedValue(defaultProject);

      await service.recordPending(wallet.id, [createMessage({ owner: wallet.address!, dseq: "103" })]);

      expect(projectRepository.findDefaultByOrganizationId).toHaveBeenCalledWith(wallet.organizationId);
      expect(deploymentDepositRepository.createMany).toHaveBeenCalledWith([expect.objectContaining({ projectId: defaultProject.id })]);
    });

    it("leaves a create unassigned when the organization has no default project", async () => {
      const { service, wallet, deploymentDepositRepository } = setup();

      await service.recordPending(wallet.id, [createMessage({ owner: wallet.address!, dseq: "104" })]);

      expect(deploymentDepositRepository.createMany).toHaveBeenCalledWith([expect.objectContaining({ projectId: null })]);
    });

    it("records a top-up in its deployment's project and leaves one into an unrecorded deployment unassigned", async () => {
      const { service, wallet, deploymentDepositRepository, deploymentSettingRepository, projectRepository } = setup();
      const projectId = faker.string.uuid();
      deploymentSettingRepository.findProjectIdsInOrganizationByDseqs.mockResolvedValue(new Map([["201", projectId]]));

      await service.recordPending(wallet.id, [
        depositMessage({ owner: wallet.address!, dseq: "201", amount: "250000" }),
        depositMessage({ owner: wallet.address!, dseq: "202", amount: "15000" })
      ]);

      expect(projectRepository.findDefaultByOrganizationId).not.toHaveBeenCalled();
      expect(deploymentDepositRepository.createMany).toHaveBeenCalledWith([
        expect.objectContaining({ kind: "top_up", dseq: "201", projectId, amountCents: 25 }),
        expect.objectContaining({ kind: "top_up", dseq: "202", projectId: null, amountCents: 2 })
      ]);
    });

    it("leaves a deposit into another owner's deployment unassigned without looking up its dseq", async () => {
      const { service, wallet, deploymentDepositRepository, deploymentSettingRepository } = setup();
      deploymentSettingRepository.findProjectIdsInOrganizationByDseqs.mockResolvedValue(new Map([["301", faker.string.uuid()]]));
      const otherOwner = createAkashAddress();

      await service.recordPending(wallet.id, [depositMessage({ owner: otherOwner, dseq: "301" }), createMessage({ owner: otherOwner, dseq: "302" })]);

      expect(deploymentSettingRepository.findProjectIdsInOrganizationByDseqs).toHaveBeenCalledWith(wallet.organizationId, []);
      expect(deploymentDepositRepository.createMany).toHaveBeenCalledWith([
        expect.objectContaining({ owner: otherOwner, projectId: null }),
        expect.objectContaining({ owner: otherOwner, projectId: null })
      ]);
    });

    it("ignores deposits into an escrow account that is not a deployment's", async () => {
      const { service, wallet, deploymentDepositRepository } = setup();

      await service.recordPending(wallet.id, [
        depositMessage({ owner: wallet.address!, dseq: "401", scope: Scope.bid }),
        depositMessage({ owner: wallet.address!, dseq: "402" })
      ]);

      expect(deploymentDepositRepository.createMany).toHaveBeenCalledWith([expect.objectContaining({ dseq: "402" })]);
    });

    it.each([
      { case: "zero", amount: "0" },
      { case: "negative", amount: "-5" },
      { case: "non-numeric", amount: "1e6" }
    ])("skips a $case deposit amount", async ({ amount }) => {
      const { service, wallet, userWalletRepository } = setup();

      const pending = await service.recordPending(wallet.id, [createMessage({ owner: wallet.address!, dseq: "501", amount })]);

      expect(pending).toEqual({ recorded: [], awaitingPrice: [] });
      expect(userWalletRepository.findById).not.toHaveBeenCalled();
    });

    it("holds an akt deposit for pricing once the outcome is known, without reading a price before signing", async () => {
      const { service, wallet, deploymentDepositRepository, denomExchangeService } = setup();

      const pending = await service.recordPending(wallet.id, [
        createMessage({ owner: wallet.address!, dseq: "601", amount: "3000000", denom: "uakt" }),
        createMessage({ owner: wallet.address!, dseq: "602", amount: "1234567", denom: "uusdc" })
      ]);

      expect(denomExchangeService.getExchangeRateToUSD).not.toHaveBeenCalled();
      expect(deploymentDepositRepository.createMany).toHaveBeenCalledWith([expect.objectContaining({ dseq: "602", amountCents: 123 })]);
      expect(pending.awaitingPrice).toEqual([expect.objectContaining({ dseq: "601", denom: "uakt", amount: "3000000" })]);
    });

    it("records no actor for a deposit signed outside a member's request", async () => {
      const { service, wallet, deploymentDepositRepository } = setup({ organizationContext: null });

      await service.recordPending(wallet.id, [depositMessage({ owner: wallet.address!, dseq: "801" })]);

      expect(deploymentDepositRepository.createMany).toHaveBeenCalledWith([expect.objectContaining({ actorUserId: null })]);
    });

    it("records no actor when no execution context is running", async () => {
      const { service, wallet, deploymentDepositRepository } = setup({ hasContext: false });

      await service.recordPending(wallet.id, [depositMessage({ owner: wallet.address!, dseq: "802" })]);

      expect(deploymentDepositRepository.createMany).toHaveBeenCalledWith([expect.objectContaining({ actorUserId: null })]);
    });

    it("records nothing for a wallet that belongs to no organization", async () => {
      const { service, deploymentDepositRepository, userWalletRepository, logger } = setup();
      const wallet = createUserWallet({ organizationId: null });
      userWalletRepository.findById.mockResolvedValue(wallet);

      const pending = await service.recordPending(wallet.id, [depositMessage({ owner: wallet.address!, dseq: "901" })]);

      expect(pending).toEqual({ recorded: [], awaitingPrice: [] });
      expect(deploymentDepositRepository.createMany).toHaveBeenCalledWith([]);
      expect(logger.debug).toHaveBeenCalledWith({ event: "DEPLOYMENT_DEPOSIT_RECORD_SKIPPED", walletId: wallet.id, reason: "wallet_without_organization" });
    });

    it("schedules a check against the chain index for the rows it records, in the same transaction, in case the signer never settles them", async () => {
      const { service, wallet, deploymentDepositRepository, jobQueueService, txService } = setup();
      const recorded = createDeposit();
      deploymentDepositRepository.createMany.mockResolvedValue([recorded]);
      const before = Date.now();

      await service.recordPending(wallet.id, [createMessage({ owner: wallet.address!, dseq: "101", amount: "5000000", denom: "uact" })]);

      expect(jobQueueService.enqueue).toHaveBeenCalledWith(new ReconcileDeploymentDeposit({ depositIds: [recorded.id] }), {
        singletonKey: `ReconcileDeploymentDeposit.unsettled.${recorded.id}`,
        startAfter: expect.any(String)
      });
      expect(deploymentDepositRepository.createMany.mock.invocationCallOrder[0]).toBeGreaterThan(txService.transaction.mock.invocationCallOrder[0]);
      expect(jobQueueService.enqueue.mock.invocationCallOrder[0]).toBeGreaterThan(deploymentDepositRepository.createMany.mock.invocationCallOrder[0]);
      const { startAfter } = jobQueueService.enqueue.mock.calls[0][1]!;
      expect(Date.parse(startAfter as string) - before).toBeGreaterThanOrEqual(5 * 60_000);
      expect(Date.parse(startAfter as string) - before).toBeLessThan(6 * 60_000);
    });

    it("schedules no check when it records no row", async () => {
      const { service, wallet, jobQueueService } = setup();

      await service.recordPending(wallet.id, [createMessage({ owner: wallet.address!, dseq: "101", denom: "uakt" })]);

      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("logs and returns nothing instead of failing the signer when the check cannot be scheduled", async () => {
      const { service, wallet, jobQueueService, logger } = setup();
      const error = new Error("queue unavailable");
      jobQueueService.enqueue.mockRejectedValue(error);

      const pending = await service.recordPending(wallet.id, [createMessage({ owner: wallet.address!, dseq: "101", amount: "5000000", denom: "uact" })]);

      expect(pending).toEqual({ recorded: [], awaitingPrice: [] });
      expect(logger.error).toHaveBeenCalledWith({ event: "DEPLOYMENT_DEPOSIT_RECORD_FAILED", walletId: wallet.id, error });
    });

    it("logs and returns nothing instead of failing the signer when the record cannot be written", async () => {
      const { service, wallet, deploymentDepositRepository, logger } = setup();
      const error = new Error("database unavailable");
      deploymentDepositRepository.createMany.mockRejectedValue(error);

      const pending = await service.recordPending(wallet.id, [depositMessage({ owner: wallet.address!, dseq: "902" })]);

      expect(pending).toEqual({ recorded: [], awaitingPrice: [] });
      expect(logger.error).toHaveBeenCalledWith({ event: "DEPLOYMENT_DEPOSIT_RECORD_FAILED", walletId: wallet.id, error });
    });
  });

  describe("recordLanded", () => {
    it("confirms the pending rows and records the akt deposits priced at the current rate, with no check to schedule", async () => {
      const { service, deploymentDepositRepository, denomExchangeService, jobQueueService } = setup();
      denomExchangeService.getExchangeRateToUSD.mockResolvedValue(rateOf(2.5));
      const recorded = [createDeposit(), createDeposit()];
      const awaiting = createUnpriced({ amount: "3000000" });

      await service.recordLanded({ recorded, awaitingPrice: [awaiting] }, { code: 0, hash: "ABC" });

      expect(deploymentDepositRepository.settlePending).toHaveBeenCalledWith(
        recorded.map(({ id }) => id),
        { status: "confirmed", txHash: "ABC" }
      );
      expect(deploymentDepositRepository.createMany).toHaveBeenCalledWith([{ ...awaiting, status: "confirmed", txHash: "ABC", amountCents: 750 }]);
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("dates an akt deposit priced after the broadcast by when signing started", async () => {
      vi.useFakeTimers();
      try {
        const { service, wallet, deploymentDepositRepository } = setup();
        const signingStartedAt = new Date("2026-10-11T10:00:00.000Z");
        vi.setSystemTime(signingStartedAt);
        const pending = await service.recordPending(wallet.id, [createMessage({ owner: wallet.address!, dseq: "71", denom: "uakt" })]);
        vi.setSystemTime(new Date("2026-10-11T10:03:00.000Z"));

        await service.recordLanded(pending, { code: 0, hash: "ABC" });

        expect(deploymentDepositRepository.createMany).toHaveBeenLastCalledWith([expect.objectContaining({ dseq: "71", createdAt: signingStartedAt })]);
      } finally {
        vi.useRealTimers();
      }
    });

    it("voids the pending rows of a transaction the chain refused and records none of the akt deposits", async () => {
      const { service, deploymentDepositRepository, denomExchangeService } = setup();
      const recorded = [createDeposit()];

      await service.recordLanded({ recorded, awaitingPrice: [createUnpriced()] }, { code: 5, hash: "DEF" });

      expect(deploymentDepositRepository.settlePending).toHaveBeenCalledWith([recorded[0].id], { status: "void", txHash: "DEF" });
      expect(deploymentDepositRepository.createMany).not.toHaveBeenCalled();
      expect(denomExchangeService.getExchangeRateToUSD).not.toHaveBeenCalled();
    });

    it("writes nothing when the transaction moved no funds", async () => {
      const { service, deploymentDepositRepository } = setup();

      await service.recordLanded({ recorded: [], awaitingPrice: [] }, { code: 0, hash: "ABC" });

      expect(deploymentDepositRepository.settlePending).not.toHaveBeenCalled();
      expect(deploymentDepositRepository.createMany).not.toHaveBeenCalled();
    });

    it.each([
      { case: "no akt price", price: 0 },
      { case: "a price that is not a number", price: Number.NaN }
    ])("leaves out akt deposits when the rate gives $case instead of counting them as nothing", async ({ price }) => {
      const { service, deploymentDepositRepository, denomExchangeService, logger } = setup();
      denomExchangeService.getExchangeRateToUSD.mockResolvedValue(rateOf(price));

      await service.recordLanded({ recorded: [], awaitingPrice: [createUnpriced({ dseq: "1" })] }, { code: 0, hash: "ABC" });

      expect(deploymentDepositRepository.createMany).toHaveBeenCalledWith([]);
      expect(logger.warn).toHaveBeenCalledWith({ event: "DEPLOYMENT_DEPOSIT_UNPRICED", dseqs: ["1"] });
    });

    it("leaves out a deposit in a denom it cannot price and records the rest", async () => {
      const { service, deploymentDepositRepository, logger } = setup();

      await service.recordLanded(
        { recorded: [], awaitingPrice: [createUnpriced({ dseq: "1" }), createUnpriced({ dseq: "2", denom: "ibc/unknown" })] },
        { code: 0, hash: "ABC" }
      );

      expect(deploymentDepositRepository.createMany).toHaveBeenCalledWith([expect.objectContaining({ dseq: "1", amountCents: 100 })]);
      expect(logger.warn).toHaveBeenCalledWith({ event: "DEPLOYMENT_DEPOSIT_UNPRICED", dseqs: ["2"] });
    });

    it("logs a failed settlement or write instead of failing a transaction that already landed", async () => {
      const { service, deploymentDepositRepository, logger } = setup();
      const error = new Error("database unavailable");
      deploymentDepositRepository.settlePending.mockRejectedValue(error);
      deploymentDepositRepository.createMany.mockRejectedValue(error);

      await expect(service.recordLanded({ recorded: [createDeposit()], awaitingPrice: [createUnpriced()] }, { code: 0, hash: "ABC" })).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith({ event: "DEPLOYMENT_DEPOSIT_SETTLE_FAILED", status: "confirmed", txHash: "ABC", error });
      expect(logger.error).toHaveBeenCalledWith({ event: "DEPLOYMENT_DEPOSIT_RECORD_FAILED", txHash: "ABC", error });
    });
  });

  describe("recordFailed", () => {
    it("voids the rows of a transaction proven not to land and records none of the akt deposits", async () => {
      const { service, deploymentDepositRepository, jobQueueService } = setup();
      const recorded = [createDeposit()];

      await service.recordFailed({ recorded, awaitingPrice: [createUnpriced()] }, new TxNotIncludedError("ABC"));

      expect(deploymentDepositRepository.settlePending).toHaveBeenCalledWith([recorded[0].id], { status: "void", txHash: undefined });
      expect(deploymentDepositRepository.createMany).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("writes an undecided transaction's akt rows with their own check, then keeps every row pending under its hash with a check by that hash", async () => {
      const { service, deploymentDepositRepository, jobQueueService, txService } = setup();
      const recorded = [createDeposit()];
      const lateRow = createDeposit();
      deploymentDepositRepository.createMany.mockResolvedValue([lateRow]);
      const before = Date.now();

      await service.recordFailed({ recorded, awaitingPrice: [createUnpriced()] }, new TxOutcomeUnknownError("ABC"));

      expect(deploymentDepositRepository.createMany).toHaveBeenCalledWith([expect.objectContaining({ status: "pending", amountCents: 100 })]);
      expect(jobQueueService.enqueue.mock.calls).toEqual([
        [
          new ReconcileDeploymentDeposit({ depositIds: [lateRow.id] }),
          { singletonKey: `ReconcileDeploymentDeposit.unsettled.${lateRow.id}`, startAfter: expect.any(String) }
        ],
        [new ReconcileDeploymentDeposit({ txHash: "ABC" }), { singletonKey: "ReconcileDeploymentDeposit.ABC", startAfter: expect.any(String) }]
      ]);
      expect(deploymentDepositRepository.attachTxHash).toHaveBeenCalledWith([recorded[0].id, lateRow.id], "ABC");
      expect(txService.transaction).toHaveBeenCalledTimes(2);
      expect(deploymentDepositRepository.attachTxHash.mock.invocationCallOrder[0]).toBeGreaterThan(txService.transaction.mock.invocationCallOrder[1]);
      const { startAfter } = jobQueueService.enqueue.mock.calls[1][1]!;
      expect(Date.parse(startAfter as string) - before).toBeGreaterThanOrEqual(5 * 60_000);
      expect(Date.parse(startAfter as string) - before).toBeLessThan(6 * 60_000);
    });

    it("leaves undecided rows the signer gave no hash for to the checks written with them", async () => {
      const { service, deploymentDepositRepository, jobQueueService } = setup();

      await service.recordFailed({ recorded: [createDeposit(), createDeposit()], awaitingPrice: [] }, new TxOutcomeUnknownError());

      expect(deploymentDepositRepository.attachTxHash).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("logs a failed check schedule instead of replacing the signer's error", async () => {
      const { service, jobQueueService, logger } = setup();
      const error = new Error("queue unavailable");
      jobQueueService.enqueue.mockRejectedValue(error);

      await expect(service.recordFailed({ recorded: [createDeposit()], awaitingPrice: [] }, new TxOutcomeUnknownError("ABC"))).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith({ event: "DEPLOYMENT_DEPOSIT_RECONCILE_SCHEDULE_FAILED", txHash: "ABC", error });
    });

    it("schedules nothing when the transaction moved no funds", async () => {
      const { service, deploymentDepositRepository, jobQueueService } = setup();

      await service.recordFailed({ recorded: [], awaitingPrice: [] }, new TxOutcomeUnknownError("ABC"));

      expect(deploymentDepositRepository.attachTxHash).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });
  });

  function createMessage(input: { owner: string; dseq: string; amount?: string; denom?: string }): EncodeObject {
    return {
      typeUrl: `/${MsgCreateDeployment.$type}`,
      value: MsgCreateDeployment.fromPartial({
        id: { owner: input.owner, dseq: BigInt(input.dseq) },
        deposit: { amount: { denom: input.denom ?? "uact", amount: input.amount ?? "500000" } }
      })
    };
  }

  function depositMessage(input: { owner: string; dseq: string; amount?: string; scope?: Scope }): EncodeObject {
    return {
      typeUrl: `/${MsgAccountDeposit.$type}`,
      value: MsgAccountDeposit.fromPartial({
        signer: input.owner,
        id: { scope: input.scope ?? Scope.deployment, xid: `${input.owner}/${input.dseq}` },
        deposit: { amount: { denom: "uact", amount: input.amount ?? "100000" } }
      })
    };
  }

  function closeMessage(dseq: string): EncodeObject {
    return { typeUrl: `/${MsgCloseDeployment.$type}`, value: MsgCloseDeployment.fromPartial({ id: { owner: createAkashAddress(), dseq: BigInt(dseq) } }) };
  }

  function createDeposit(): DeploymentDepositOutput {
    return mock<DeploymentDepositOutput>({ id: faker.string.uuid() });
  }

  function createUnpriced(overrides: Partial<PendingDeposits["awaitingPrice"][number]> = {}): PendingDeposits["awaitingPrice"][number] {
    return {
      kind: "top_up",
      owner: createAkashAddress(),
      dseq: faker.string.numeric(8),
      amount: "500000",
      denom: "uakt",
      organizationId: faker.string.uuid(),
      projectId: null,
      actorUserId: null,
      createdAt: new Date(),
      ...overrides
    };
  }

  function rateOf(price: number): Awaited<ReturnType<DenomExchangeService["getExchangeRateToUSD"]>> {
    return { price, volume: 0, marketCap: 0, marketCapRank: 0, priceChange24h: 0, priceChangePercentage24: 0 };
  }

  function setup(input: { organizationContext?: OrganizationContext | null; hasContext?: boolean } = {}) {
    const wallet = createUserWallet({ organizationId: faker.string.uuid() });
    const currentUser: UserOutput = createUser();
    const organizationContext =
      input.organizationContext === null
        ? undefined
        : input.organizationContext ?? mock<OrganizationContext>({ organizationId: wallet.organizationId!, mode: "organization" });
    const userWalletRepository = mock<UserWalletRepository>({ findById: vi.fn().mockResolvedValue(wallet) });
    const deploymentDepositRepository = mock<DeploymentDepositRepository>({
      createMany: vi.fn(async (rows: DeploymentDepositInput[]) => rows.map(row => ({ ...row }) as DeploymentDepositOutput))
    });
    const deploymentSettingRepository = mock<DeploymentSettingRepository>({ findProjectIdsInOrganizationByDseqs: vi.fn().mockResolvedValue(new Map()) });
    const projectRepository = mock<ProjectRepository>({ findDefaultByOrganizationId: vi.fn().mockResolvedValue(undefined) });
    const denomExchangeService = mock<DenomExchangeService>({ getExchangeRateToUSD: vi.fn().mockResolvedValue(rateOf(2)) });
    const jobQueueService = mock<JobQueueService>();
    const txService = mock<TxService>({ transaction: vi.fn(async cb => await cb()) as TxService["transaction"] });
    const executionContextService = mock<ExecutionContextService>({
      hasContext: vi.fn().mockReturnValue(input.hasContext ?? true),
      get: vi.fn((key: string) => ({ ORGANIZATION_CONTEXT: organizationContext, CURRENT_USER: currentUser })[key]) as ExecutionContextService["get"]
    });
    const logger = mock<ReturnType<CreateLogger>>();

    const service = new DeploymentDepositLedgerService(
      userWalletRepository,
      deploymentDepositRepository,
      deploymentSettingRepository,
      projectRepository,
      denomExchangeService,
      jobQueueService,
      txService,
      executionContextService,
      () => logger
    );

    return {
      service,
      wallet,
      currentUser,
      userWalletRepository,
      deploymentDepositRepository,
      deploymentSettingRepository,
      projectRepository,
      denomExchangeService,
      jobQueueService,
      txService,
      logger
    };
  }
});
