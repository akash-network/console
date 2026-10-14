import { MsgAccountDeposit, Scope } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { MsgCloseDeployment, MsgCreateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import type { EncodeObject, GeneratedType } from "@cosmjs/proto-signing";
import { Registry } from "@cosmjs/proto-signing";
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
import { FeatureFlags, type FeatureFlagValue } from "@src/core/services/feature-flags/feature-flags";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { TxService } from "@src/core/services/tx/tx.service";
import type { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { OrganizationOutput, OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import type { ProjectOutput, ProjectRepository } from "@src/organization/repositories/project/project.repository";
import {
  type ProjectBudgetEnforcementService,
  ProjectBudgetExceededError
} from "@src/organization/services/project-budget-enforcement/project-budget-enforcement.service";
import type { ProjectScope } from "@src/organization/types/organization-context";
import type { UserOutput } from "@src/user/repositories";
import { DeploymentDepositLedgerService, type PendingDeposits } from "./deployment-deposit-ledger.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createOrganizationContext, createProjectsScope } from "@test/seeders/organization-context.seeder";
import { createUser } from "@test/seeders/user.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

describe(DeploymentDepositLedgerService.name, () => {
  describe("recordPending", () => {
    it.each([
      { case: "a close", message: () => closeMessage("1") },
      { case: "a create depositing nothing", message: () => createMessage({ owner: createAkashAddress(), dseq: "1", amount: "0" }) },
      {
        case: "a create without a deposit",
        message: () => ({ typeUrl: `/${MsgCreateDeployment.$type}`, value: MsgCreateDeployment.fromPartial({ id: { owner: "akash1", dseq: 1n } }) })
      }
    ])("records nothing and reads no wallet for $case", async ({ message }) => {
      const { service, userWalletRepository, projectBudgetEnforcementService } = setup();

      expect(await service.recordPending(1, [message()])).toEqual({ recorded: [], awaitingPrice: [] });
      expect(userWalletRepository.findById).not.toHaveBeenCalled();
      expect(projectBudgetEnforcementService.enforce).not.toHaveBeenCalled();
    });

    it("records a create through the budgets in the project its record is filed in, priced in cents", async () => {
      const { service, wallet, deploymentDepositRepository, deploymentSettingRepository, projectBudgetEnforcementService, currentUser } = setup();
      const projectId = faker.string.uuid();
      deploymentSettingRepository.findProjectIdsInOrganizationByDseqs.mockResolvedValue(new Map([["101", projectId]]));

      const recorded = await service.recordPending(wallet.id, [createMessage({ owner: wallet.address!, dseq: "101", amount: "5000000", denom: "uact" })]);

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
      expect(projectBudgetEnforcementService.enforce).toHaveBeenCalledWith([row], expect.any(Function));
      expect(deploymentDepositRepository.createMany).toHaveBeenCalledWith([row]);
      expect(recorded).toEqual({ recorded: [row], awaitingPrice: [] });
    });

    it("judges a create in the project its caller signs it for, ahead of the project a record names", async () => {
      const { service, wallet, deploymentSettingRepository, projectRepository, projectBudgetEnforcementService } = setup();
      const filingProjectId = faker.string.uuid();
      deploymentSettingRepository.findProjectIdsInOrganizationByDseqs.mockResolvedValue(new Map([["102", faker.string.uuid()]]));

      await service.recordPending(wallet.id, [createMessage({ owner: wallet.address!, dseq: "102" })], { filingProjectId });

      expect(projectRepository.findDefaultByOrganizationId).not.toHaveBeenCalled();
      expect(projectBudgetEnforcementService.enforce).toHaveBeenCalledWith([expect.objectContaining({ projectId: filingProjectId })], expect.any(Function));
    });

    it("judges a create nobody filed in the organization's default project", async () => {
      const { service, wallet, projectRepository, projectBudgetEnforcementService } = setup();
      const defaultProject = mock<ProjectOutput>({ id: faker.string.uuid() });
      projectRepository.findDefaultByOrganizationId.mockResolvedValue(defaultProject);

      await service.recordPending(wallet.id, [createMessage({ owner: wallet.address!, dseq: "103" })]);

      expect(projectRepository.findDefaultByOrganizationId).toHaveBeenCalledWith(wallet.organizationId);
      expect(projectBudgetEnforcementService.enforce).toHaveBeenCalledWith([expect.objectContaining({ projectId: defaultProject.id })], expect.any(Function));
    });

    it("judges a create whose record names no project in the default project too", async () => {
      const { service, wallet, deploymentSettingRepository, projectRepository, projectBudgetEnforcementService } = setup();
      deploymentSettingRepository.findProjectIdsInOrganizationByDseqs.mockResolvedValue(new Map([["104", null]]));
      projectRepository.findDefaultByOrganizationId.mockResolvedValue(mock<ProjectOutput>({ id: "default-project" }));

      await service.recordPending(wallet.id, [createMessage({ owner: wallet.address!, dseq: "104" })]);

      expect(projectBudgetEnforcementService.enforce).toHaveBeenCalledWith([expect.objectContaining({ projectId: "default-project" })], expect.any(Function));
    });

    it("leaves a create unassigned only when the organization has no default project", async () => {
      const { service, wallet, projectBudgetEnforcementService } = setup();

      await service.recordPending(wallet.id, [createMessage({ owner: wallet.address!, dseq: "105" })]);

      expect(projectBudgetEnforcementService.enforce).toHaveBeenCalledWith([expect.objectContaining({ projectId: null })], expect.any(Function));
    });

    it("files a top-up into a deployment created in the same transaction where the create goes when nobody chose a project", async () => {
      const { service, wallet, projectRepository, projectBudgetEnforcementService } = setup();
      const defaultProject = mock<ProjectOutput>({ id: faker.string.uuid() });
      projectRepository.findDefaultByOrganizationId.mockResolvedValue(defaultProject);

      await service.recordPending(wallet.id, [createMessage({ owner: wallet.address!, dseq: "65" }), depositMessage({ owner: wallet.address!, dseq: "65" })]);

      expect(projectBudgetEnforcementService.enforce).toHaveBeenCalledWith(
        [
          expect.objectContaining({ kind: "deployment_create", projectId: defaultProject.id }),
          expect.objectContaining({ kind: "top_up", projectId: defaultProject.id })
        ],
        expect.any(Function)
      );
    });

    it("judges every spending message of the transaction together, a top-up into an unrecorded deployment as unassigned", async () => {
      const { service, wallet, deploymentSettingRepository, projectBudgetEnforcementService } = setup();
      deploymentSettingRepository.findProjectIdsInOrganizationByDseqs.mockResolvedValue(
        new Map([
          ["201", "project-a"],
          ["202", "project-b"]
        ])
      );

      await service.recordPending(wallet.id, [
        createMessage({ owner: wallet.address!, dseq: "201", amount: "15000" }),
        depositMessage({ owner: wallet.address!, dseq: "201", amount: "250000" }),
        depositMessage({ owner: wallet.address!, dseq: "202", amount: "250000" }),
        depositMessage({ owner: wallet.address!, dseq: "203", amount: "250000" })
      ]);

      expect(projectBudgetEnforcementService.enforce).toHaveBeenCalledTimes(1);
      expect(projectBudgetEnforcementService.enforce).toHaveBeenCalledWith(
        [
          expect.objectContaining({ kind: "deployment_create", dseq: "201", projectId: "project-a", amountCents: 2 }),
          expect.objectContaining({ kind: "top_up", dseq: "201", projectId: "project-a", amountCents: 25 }),
          expect.objectContaining({ kind: "top_up", dseq: "202", projectId: "project-b", amountCents: 25 }),
          expect.objectContaining({ kind: "top_up", dseq: "203", projectId: null, amountCents: 25 })
        ],
        expect.any(Function)
      );
    });

    it.each([
      { case: "a create for another owner", message: () => createMessage({ owner: createAkashAddress(), dseq: "301" }) },
      { case: "a top-up into another owner's deployment", message: () => depositMessage({ owner: createAkashAddress(), dseq: "302" }) },
      { case: "a top-up another account signs", message: (address: string) => depositMessage({ owner: address, dseq: "303", signer: createAkashAddress() }) }
    ])("refuses $case", async ({ message }) => {
      const { service, wallet, projectBudgetEnforcementService } = setup();

      await expect(service.recordPending(wallet.id, [message(wallet.address!)])).rejects.toMatchObject({ status: 403, errorCode: "message_signer_mismatch" });
      expect(projectBudgetEnforcementService.enforce).not.toHaveBeenCalled();
    });

    it.each([
      { case: "an earlier version of the create", message: () => ({ typeUrl: "/akash.deployment.v1beta3.MsgCreateDeployment", value: {} }) },
      { case: "an earlier deposit message", message: () => ({ typeUrl: "/akash.deployment.v1beta3.MsgDepositDeployment", value: {} }) },
      { case: "a deposit wrapped in an authz exec", message: () => ({ typeUrl: "/cosmos.authz.v1beta1.MsgExec", value: { msgs: [] } }) },
      { case: "a bank send", message: () => ({ typeUrl: "/cosmos.bank.v1beta1.MsgSend", value: {} }) },
      {
        case: "a deposit into an escrow account that is not a deployment's",
        message: () => depositMessage({ owner: "akash1owner", dseq: "1", scope: Scope.bid })
      }
    ])("refuses a transaction holding $case", async ({ message }) => {
      const { service, wallet, projectBudgetEnforcementService } = setup();

      await expect(service.recordPending(wallet.id, [createMessage({ owner: wallet.address!, dseq: "9" }), message()])).rejects.toMatchObject({
        status: 400,
        errorCode: "unsupported_message"
      });
      expect(projectBudgetEnforcementService.enforce).not.toHaveBeenCalled();
    });

    it("reads the fields as the registry encodes them for signing", async () => {
      const { service, wallet, projectBudgetEnforcementService } = setup();
      const message = {
        typeUrl: `/${MsgCreateDeployment.$type}`,
        value: { id: { owner: wallet.address, dseq: 123 }, deposit: { amount: { denom: "uact", amount: "700000", extra: "ignored" } }, unknownField: true }
      };

      await service.recordPending(wallet.id, [message]);

      expect(projectBudgetEnforcementService.enforce).toHaveBeenCalledWith(
        [expect.objectContaining({ dseq: "123", amount: "700000", denom: "uact", amountCents: 70 })],
        expect.any(Function)
      );
    });

    it("prices an akt deposit at the current exchange rate", async () => {
      const { service, wallet, denomExchangeService, projectBudgetEnforcementService } = setup();
      denomExchangeService.getExchangeRateToUSD.mockResolvedValue(rateOf(2.5));

      await service.recordPending(wallet.id, [createMessage({ owner: wallet.address!, dseq: "601", amount: "3000000", denom: "uakt" })]);

      expect(denomExchangeService.getExchangeRateToUSD).toHaveBeenCalledWith("akt");
      expect(projectBudgetEnforcementService.enforce).toHaveBeenCalledWith([expect.objectContaining({ amountCents: 750 })], expect.any(Function));
    });

    it("prices a usdc deposit at face value", async () => {
      const { service, wallet, denomExchangeService, projectBudgetEnforcementService } = setup();

      await service.recordPending(wallet.id, [createMessage({ owner: wallet.address!, dseq: "701", amount: "1234567", denom: "uusdc" })]);

      expect(denomExchangeService.getExchangeRateToUSD).not.toHaveBeenCalled();
      expect(projectBudgetEnforcementService.enforce).toHaveBeenCalledWith([expect.objectContaining({ amountCents: 123 })], expect.any(Function));
    });

    it.each([
      { case: "no price", price: 0 },
      { case: "a price that is not a number", price: Number.NaN }
    ])("refuses an akt deposit when the rate gives $case", async ({ price }) => {
      const { service, wallet, denomExchangeService, projectBudgetEnforcementService } = setup();
      denomExchangeService.getExchangeRateToUSD.mockResolvedValue(rateOf(price));

      await expect(service.recordPending(wallet.id, [createMessage({ owner: wallet.address!, dseq: "602", denom: "uakt" })])).rejects.toMatchObject({
        status: 503,
        errorCode: "deposit_price_unavailable"
      });
      expect(projectBudgetEnforcementService.enforce).not.toHaveBeenCalled();
    });

    it("refuses a deposit in a denom it cannot price", async () => {
      const { service, wallet, projectBudgetEnforcementService } = setup();

      await expect(service.recordPending(wallet.id, [createMessage({ owner: wallet.address!, dseq: "702", denom: "ibc/unknown" })])).rejects.toMatchObject({
        status: 400,
        errorCode: "unsupported_deposit_denom"
      });
      expect(projectBudgetEnforcementService.enforce).not.toHaveBeenCalled();
    });

    it.each([
      { case: "a negative amount", message: () => createMessage({ owner: "akash1owner", dseq: "1", amount: "-5" }) },
      { case: "an amount that is not a whole number", message: () => createMessage({ owner: "akash1owner", dseq: "1", amount: "1e6" }) },
      {
        case: "no deployment id",
        message: () => ({
          typeUrl: `/${MsgCreateDeployment.$type}`,
          value: MsgCreateDeployment.fromPartial({ deposit: { amount: { denom: "uact", amount: "5" } } })
        })
      },
      { case: "a deployment account without a dseq", message: () => depositMessage({ owner: "akash1owner", dseq: "" }) },
      { case: "a deployment account with more than an owner and a dseq", message: () => depositMessage({ owner: "akash1owner", dseq: "1/2" }) },
      { case: "a deployment account whose dseq is not a number", message: () => depositMessage({ owner: "akash1owner", dseq: "abc" }) },
      { case: "an amount with a leading plus", message: () => createMessage({ owner: "akash1owner", dseq: "1", amount: "+5" }) },
      { case: "an amount with a decimal point", message: () => createMessage({ owner: "akash1owner", dseq: "1", amount: "5.0" }) },
      { case: "an amount with whitespace", message: () => createMessage({ owner: "akash1owner", dseq: "1", amount: " 5" }) },
      { case: "an empty amount", message: () => createMessage({ owner: "akash1owner", dseq: "1", amount: "" }) },
      {
        case: "several coins where the chain takes one",
        message: () => ({
          typeUrl: `/${MsgCreateDeployment.$type}`,
          value: {
            id: { owner: "akash1owner", dseq: 1n },
            deposit: {
              amount: [
                { denom: "uact", amount: "1" },
                { denom: "uact", amount: "1000000000" }
              ]
            }
          }
        })
      }
    ])("refuses the whole transaction when a spending message has $case", async ({ message }) => {
      const { service, wallet, projectBudgetEnforcementService } = setup();

      await expect(service.recordPending(wallet.id, [createMessage({ owner: wallet.address!, dseq: "9" }), message()])).rejects.toMatchObject({
        status: 400,
        errorCode: "invalid_deposit"
      });
      expect(projectBudgetEnforcementService.enforce).not.toHaveBeenCalled();
    });

    it.each([
      { case: "reading the wallet", fail: (mocks: ReturnType<typeof setup>) => mocks.userWalletRepository.findById.mockRejectedValue(new Error("down")) },
      {
        case: "reading the deployments' projects",
        fail: (mocks: ReturnType<typeof setup>) => mocks.deploymentSettingRepository.findProjectIdsInOrganizationByDseqs.mockRejectedValue(new Error("down"))
      },
      {
        case: "reading the default project",
        fail: (mocks: ReturnType<typeof setup>) => mocks.projectRepository.findDefaultByOrganizationId.mockRejectedValue(new Error("down"))
      },
      {
        case: "pricing the deposit",
        fail: (mocks: ReturnType<typeof setup>) => mocks.denomExchangeService.getExchangeRateToUSD.mockRejectedValue(new Error("down"))
      },
      {
        case: "judging or recording the deposit",
        fail: (mocks: ReturnType<typeof setup>) => mocks.projectBudgetEnforcementService.enforce.mockRejectedValue(new Error("down"))
      },
      {
        case: "scheduling the check of the pending rows",
        fail: (mocks: ReturnType<typeof setup>) => mocks.jobQueueService.enqueue.mockRejectedValue(new Error("down"))
      }
    ])("refuses the signing when $case fails in organization mode", async ({ fail }) => {
      const mocks = setup();
      fail(mocks);

      await expect(mocks.service.recordPending(mocks.wallet.id, [createMessage({ owner: mocks.wallet.address!, dseq: "11", denom: "uakt" })])).rejects.toThrow(
        "down"
      );
      expect(mocks.logger.error).not.toHaveBeenCalled();
    });

    it("schedules a check against the chain index for the rows it records, inside the budgets' transaction, in case the signer never settles them", async () => {
      const { service, wallet, deploymentDepositRepository, projectBudgetEnforcementService, jobQueueService } = setup();
      const recorded = createDeposit();
      deploymentDepositRepository.createMany.mockResolvedValue([recorded]);
      const before = Date.now();

      await service.recordPending(wallet.id, [createMessage({ owner: wallet.address!, dseq: "13", amount: "5000000", denom: "uact" })]);

      expect(jobQueueService.enqueue).toHaveBeenCalledWith(new ReconcileDeploymentDeposit({ depositIds: [recorded.id] }), {
        singletonKey: `ReconcileDeploymentDeposit.unsettled.${recorded.id}`,
        startAfter: expect.any(String)
      });
      expect(jobQueueService.enqueue.mock.invocationCallOrder[0]).toBeGreaterThan(projectBudgetEnforcementService.enforce.mock.invocationCallOrder[0]);
      expect(jobQueueService.enqueue.mock.invocationCallOrder[0]).toBeGreaterThan(deploymentDepositRepository.createMany.mock.invocationCallOrder[0]);
      const { startAfter } = jobQueueService.enqueue.mock.calls[0][1]!;
      expect(Date.parse(startAfter as string) - before).toBeGreaterThanOrEqual(5 * 60_000);
      expect(Date.parse(startAfter as string) - before).toBeLessThan(6 * 60_000);
    });

    it("lets a budget refusal through to the signer", async () => {
      const { service, wallet, projectBudgetEnforcementService, deploymentDepositRepository } = setup();
      const refusal = new ProjectBudgetExceededError(["12"], ["project-1"]);
      projectBudgetEnforcementService.enforce.mockRejectedValue(refusal);

      await expect(service.recordPending(wallet.id, [createMessage({ owner: wallet.address!, dseq: "12" })])).rejects.toBe(refusal);
      expect(deploymentDepositRepository.createMany).not.toHaveBeenCalled();
    });

    it("returns no rows when the budgets record nothing", async () => {
      const { service, wallet, projectBudgetEnforcementService } = setup();
      projectBudgetEnforcementService.enforce.mockResolvedValue(undefined);

      expect(await service.recordPending(wallet.id, [createMessage({ owner: wallet.address!, dseq: "13" })])).toEqual({ recorded: [], awaitingPrice: [] });
    });

    describe("for a caller limited to some projects", () => {
      it.each([
        { case: "a deployment nobody filed", filedIn: () => undefined },
        { case: "a deployment of a project it only reads", filedIn: (projects: { readOnly: string }) => projects.readOnly },
        { case: "a deployment of a project outside its reach", filedIn: () => faker.string.uuid() }
      ])("refuses a top-up into $case", async ({ filedIn }) => {
        const writable = faker.string.uuid();
        const readOnly = faker.string.uuid();
        const { service, wallet, deploymentSettingRepository, projectBudgetEnforcementService, deploymentDepositRepository } = setup({
          projectScope: createProjectsScope([writable, readOnly], { writableProjectIds: [writable] })
        });
        deploymentSettingRepository.findProjectIdsInOrganizationByDseqs.mockResolvedValue(new Map([["61", filedIn({ readOnly }) ?? null]]));
        const messages = [depositMessage({ owner: wallet.address!, dseq: "61" })];

        await expect(service.recordPending(wallet.id, messages)).rejects.toMatchObject({ status: 403, errorCode: "project_forbidden" });
        await expect(service.assertWithinBudgets(wallet.id, messages)).rejects.toMatchObject({ status: 403, errorCode: "project_forbidden" });
        expect(projectBudgetEnforcementService.enforce).not.toHaveBeenCalled();
        expect(deploymentDepositRepository.createMany).not.toHaveBeenCalled();
      });

      it("records a top-up into a deployment of a project it can write to", async () => {
        const writable = faker.string.uuid();
        const { service, wallet, deploymentSettingRepository, deploymentDepositRepository, projectBudgetEnforcementService } = setup({
          projectScope: createProjectsScope([writable])
        });
        deploymentSettingRepository.findProjectIdsInOrganizationByDseqs.mockResolvedValue(new Map([["62", writable]]));

        await service.recordPending(wallet.id, [depositMessage({ owner: wallet.address!, dseq: "62" })]);

        expect(projectBudgetEnforcementService.enforce).toHaveBeenCalledWith(
          [expect.objectContaining({ dseq: "62", projectId: writable })],
          expect.any(Function)
        );
        expect(deploymentDepositRepository.findCreateProjectIds).toHaveBeenCalledWith(wallet.organizationId, wallet.address, []);
      });

      it("records a top-up into a deployment created in the same transaction in the project the create is filed in", async () => {
        const writable = faker.string.uuid();
        const { service, wallet, projectBudgetEnforcementService } = setup({ projectScope: createProjectsScope([writable]) });

        await service.recordPending(
          wallet.id,
          [createMessage({ owner: wallet.address!, dseq: "63" }), depositMessage({ owner: wallet.address!, dseq: "63" })],
          {
            filingProjectId: writable
          }
        );

        expect(projectBudgetEnforcementService.enforce).toHaveBeenCalledWith(
          [expect.objectContaining({ kind: "deployment_create", projectId: writable }), expect.objectContaining({ kind: "top_up", projectId: writable })],
          expect.any(Function)
        );
      });

      it("records a top-up into a deployment whose create the ledger holds before the deployment is filed, in the create's project", async () => {
        const writable = faker.string.uuid();
        const { service, wallet, deploymentDepositRepository, projectBudgetEnforcementService } = setup({ projectScope: createProjectsScope([writable]) });
        deploymentDepositRepository.findCreateProjectIds.mockResolvedValue(new Map([["64", writable]]));

        await service.recordPending(wallet.id, [depositMessage({ owner: wallet.address!, dseq: "64" })]);

        expect(deploymentDepositRepository.findCreateProjectIds).toHaveBeenCalledWith(wallet.organizationId, wallet.address, ["64"]);
        expect(projectBudgetEnforcementService.enforce).toHaveBeenCalledWith(
          [expect.objectContaining({ dseq: "64", projectId: writable })],
          expect.any(Function)
        );
      });
    });

    it("records nothing for a wallet that belongs to no organization", async () => {
      const { service, userWalletRepository, projectBudgetEnforcementService, logger } = setup();
      const wallet = createUserWallet({ organizationId: null });
      userWalletRepository.findById.mockResolvedValue(wallet);

      expect(await service.recordPending(wallet.id, [depositMessage({ owner: wallet.address!, dseq: "14" })])).toEqual({ recorded: [], awaitingPrice: [] });
      expect(projectBudgetEnforcementService.enforce).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith({ event: "DEPLOYMENT_DEPOSIT_RECORD_SKIPPED", walletId: wallet.id, reason: "wallet_without_organization" });
    });

    describe("for a request in legacy mode", () => {
      it("records the deposits without budgets", async () => {
        const { service, wallet, deploymentDepositRepository, projectBudgetEnforcementService } = setup({ mode: "legacy" });

        await service.recordPending(wallet.id, [depositMessage({ owner: wallet.address!, dseq: "21" })]);

        expect(projectBudgetEnforcementService.enforce).not.toHaveBeenCalled();
        expect(deploymentDepositRepository.createMany).toHaveBeenCalledWith([expect.objectContaining({ dseq: "21" })]);
      });

      it("records a deposit into another owner's deployment as unassigned and ignores a message it does not read", async () => {
        const { service, wallet, deploymentDepositRepository, deploymentSettingRepository } = setup({ mode: "legacy" });
        const otherOwner = createAkashAddress();

        await service.recordPending(wallet.id, [depositMessage({ owner: otherOwner, dseq: "26" }), { typeUrl: "/cosmos.bank.v1beta1.MsgSend", value: {} }]);

        expect(deploymentSettingRepository.findProjectIdsInOrganizationByDseqs).toHaveBeenCalledWith(wallet.organizationId, []);
        expect(deploymentDepositRepository.createMany).toHaveBeenCalledWith([expect.objectContaining({ owner: otherOwner, projectId: null })]);
      });

      it("records the well-formed deposits and leaves a malformed message to the chain", async () => {
        const { service, wallet, deploymentDepositRepository } = setup({ mode: "legacy" });

        await service.recordPending(wallet.id, [
          depositMessage({ owner: wallet.address!, dseq: "22" }),
          createMessage({ owner: wallet.address!, dseq: "23", amount: "-1" })
        ]);

        expect(deploymentDepositRepository.createMany).toHaveBeenCalledWith([expect.objectContaining({ dseq: "22" })]);
      });

      it("records nothing and reads no wallet when only a malformed message moves funds", async () => {
        const { service, wallet, userWalletRepository } = setup({ mode: "legacy" });

        expect(await service.recordPending(wallet.id, [createMessage({ owner: wallet.address!, dseq: "24", amount: "-1" })])).toEqual({
          recorded: [],
          awaitingPrice: []
        });
        expect(userWalletRepository.findById).not.toHaveBeenCalled();
      });

      it.each([
        {
          case: "the wallet cannot be read",
          fail: (mocks: ReturnType<typeof setup>) => mocks.userWalletRepository.findById.mockRejectedValue(new Error("down"))
        },
        {
          case: "the rows cannot be written",
          fail: (mocks: ReturnType<typeof setup>) => mocks.deploymentDepositRepository.createMany.mockRejectedValue(new Error("down"))
        },
        {
          case: "their check cannot be scheduled",
          fail: (mocks: ReturnType<typeof setup>) => mocks.jobQueueService.enqueue.mockRejectedValue(new Error("down"))
        }
      ])("logs and lets the signer go on when $case", async ({ fail }) => {
        const mocks = setup({ mode: "legacy" });
        fail(mocks);

        expect(await mocks.service.recordPending(mocks.wallet.id, [createMessage({ owner: mocks.wallet.address!, dseq: "25" })])).toEqual({
          recorded: [],
          awaitingPrice: []
        });
        expect(mocks.logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "DEPLOYMENT_DEPOSIT_RECORD_FAILED", walletId: mocks.wallet.id }));
      });

      it("schedules a check against the chain index for the rows it records, in the same transaction", async () => {
        const { service, wallet, deploymentDepositRepository, jobQueueService, txService } = setup({ mode: "legacy" });
        const recorded = createDeposit();
        deploymentDepositRepository.createMany.mockResolvedValue([recorded]);

        await service.recordPending(wallet.id, [createMessage({ owner: wallet.address!, dseq: "28", amount: "5000000", denom: "uact" })]);

        expect(jobQueueService.enqueue).toHaveBeenCalledWith(new ReconcileDeploymentDeposit({ depositIds: [recorded.id] }), {
          singletonKey: `ReconcileDeploymentDeposit.unsettled.${recorded.id}`,
          startAfter: expect.any(String)
        });
        expect(deploymentDepositRepository.createMany.mock.invocationCallOrder[0]).toBeGreaterThan(txService.transaction.mock.invocationCallOrder[0]);
      });

      it("holds an akt deposit for pricing after the broadcast, reading no price before signing", async () => {
        const { service, wallet, denomExchangeService, deploymentDepositRepository, jobQueueService } = setup({ mode: "legacy" });

        const pending = await service.recordPending(wallet.id, [createMessage({ owner: wallet.address!, dseq: "27", denom: "uakt" })]);

        expect(denomExchangeService.getExchangeRateToUSD).not.toHaveBeenCalled();
        expect(deploymentDepositRepository.createMany).toHaveBeenCalledWith([]);
        expect(jobQueueService.enqueue).not.toHaveBeenCalled();
        expect(pending.awaitingPrice).toEqual([expect.objectContaining({ dseq: "27", denom: "uakt" })]);
      });
    });

    describe("for a job", () => {
      it.each<{ case: string; enabledFlags: FeatureFlagValue[]; asksOwnerFlag: boolean }>([
        { case: "organizations are enforced for everyone", enabledFlags: [FeatureFlags.ORGANIZATIONS_ENFORCE], asksOwnerFlag: false },
        { case: "organizations are on for the wallet's owner", enabledFlags: [FeatureFlags.ORGANIZATIONS], asksOwnerFlag: true }
      ])("holds the deposits to budgets while $case", async ({ enabledFlags, asksOwnerFlag }) => {
        const { service, wallet, featureFlagsService, projectBudgetEnforcementService } = setup({ mode: "job", enabledFlags });

        await service.recordPending(wallet.id, [depositMessage({ owner: wallet.address!, dseq: "31" })]);

        const ownerFlagCheck = [FeatureFlags.ORGANIZATIONS, { userId: wallet.userId }];
        expect(projectBudgetEnforcementService.enforce).toHaveBeenCalledTimes(1);
        expect(featureFlagsService.isEnabled.mock.calls).toEqual([[FeatureFlags.ORGANIZATIONS_ENFORCE], ...[ownerFlagCheck].slice(0, Number(asksOwnerFlag))]);
      });

      it("records the deposits without budgets and logs a failure while organizations are off for the owner of a personal wallet", async () => {
        const { service, wallet, projectBudgetEnforcementService, deploymentDepositRepository, organizationRepository, logger } = setup({ mode: "job" });
        deploymentDepositRepository.createMany.mockRejectedValue(new Error("down"));

        expect(await service.recordPending(wallet.id, [depositMessage({ owner: wallet.address!, dseq: "32" })])).toEqual({ recorded: [], awaitingPrice: [] });
        expect(organizationRepository.findById).toHaveBeenCalledWith(wallet.organizationId);
        expect(projectBudgetEnforcementService.enforce).not.toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "DEPLOYMENT_DEPOSIT_RECORD_FAILED" }));
      });

      it("holds a team organization's wallet to budgets with every organization flag off", async () => {
        const { service, wallet, featureFlagsService, projectBudgetEnforcementService } = setup({ mode: "job", walletOrganizationType: "team" });
        const refusal = new ProjectBudgetExceededError(["38"], ["project-1"]);
        projectBudgetEnforcementService.enforce.mockRejectedValueOnce(refusal);

        await expect(service.recordPending(wallet.id, [depositMessage({ owner: wallet.address!, dseq: "38" })])).rejects.toBe(refusal);
        await expect(service.assertWithinBudgets(wallet.id, [depositMessage({ owner: wallet.address!, dseq: "38" })])).resolves.toBeUndefined();
        expect(projectBudgetEnforcementService.enforce).toHaveBeenCalledTimes(2);
        expect(featureFlagsService.isEnabled).not.toHaveBeenCalledWith(FeatureFlags.ORGANIZATIONS, expect.anything());
      });

      it("holds a wallet whose organization cannot be found to budgets with every organization flag off", async () => {
        const { service, wallet, organizationRepository, projectBudgetEnforcementService } = setup({ mode: "job" });
        organizationRepository.findById.mockResolvedValue(undefined);

        await service.recordPending(wallet.id, [depositMessage({ owner: wallet.address!, dseq: "39" })]);

        expect(projectBudgetEnforcementService.enforce).toHaveBeenCalledTimes(1);
      });

      it("refuses a message it cannot read for a team organization's wallet with every organization flag off", async () => {
        const { service, wallet } = setup({ mode: "job", walletOrganizationType: "team" });

        await expect(service.recordPending(wallet.id, [{ typeUrl: "/cosmos.bank.v1beta1.MsgSend", value: {} }])).rejects.toMatchObject({
          status: 400,
          errorCode: "unsupported_message"
        });
      });

      it.each([
        { case: "the wallet", fail: (mocks: ReturnType<typeof setup>) => mocks.userWalletRepository.findById.mockRejectedValue(new Error("down")) },
        {
          case: "the wallet's organization",
          fail: (mocks: ReturnType<typeof setup>) => mocks.organizationRepository.findById.mockRejectedValue(new Error("down"))
        }
      ])("refuses the signing when $case cannot be read", async ({ fail }) => {
        const mocks = setup({ mode: "job" });
        fail(mocks);

        await expect(mocks.service.recordPending(mocks.wallet.id, [depositMessage({ owner: mocks.wallet.address!, dseq: "36" })])).rejects.toThrow("down");
        await expect(mocks.service.assertWithinBudgets(mocks.wallet.id, [depositMessage({ owner: mocks.wallet.address!, dseq: "36" })])).rejects.toThrow(
          "down"
        );
        expect(mocks.projectBudgetEnforcementService.enforce).not.toHaveBeenCalled();
      });

      it("refuses a request whose wallet cannot be read in organization mode", async () => {
        const { service, wallet, userWalletRepository } = setup();
        userWalletRepository.findById.mockRejectedValue(new Error("down"));

        await expect(service.assertWithinBudgets(wallet.id, [depositMessage({ owner: wallet.address!, dseq: "37" })])).rejects.toThrow("down");
      });

      it("records no actor", async () => {
        const { service, wallet, projectBudgetEnforcementService } = setup({ mode: "job", enabledFlags: [FeatureFlags.ORGANIZATIONS_ENFORCE] });

        await service.recordPending(wallet.id, [depositMessage({ owner: wallet.address!, dseq: "34" })]);

        expect(projectBudgetEnforcementService.enforce).toHaveBeenCalledWith([expect.objectContaining({ actorUserId: null })], expect.any(Function));
      });

      it("holds the deposits to the flags of the wallet's owner outside any execution context", async () => {
        const { service, wallet, projectBudgetEnforcementService } = setup({ mode: "job", hasContext: false, enabledFlags: [FeatureFlags.ORGANIZATIONS] });

        await service.recordPending(wallet.id, [depositMessage({ owner: wallet.address!, dseq: "35" })]);

        expect(projectBudgetEnforcementService.enforce).toHaveBeenCalled();
      });
    });
  });

  describe("assertWithinBudgets", () => {
    it("asks the budgets to judge the deposits without recording them", async () => {
      const { service, wallet, projectBudgetEnforcementService, deploymentDepositRepository } = setup();
      const filingProjectId = faker.string.uuid();

      await service.assertWithinBudgets(wallet.id, [createMessage({ owner: wallet.address!, dseq: "41" })], { filingProjectId });

      expect(projectBudgetEnforcementService.enforce).toHaveBeenCalledWith([expect.objectContaining({ dseq: "41", projectId: filingProjectId })]);
      expect(deploymentDepositRepository.createMany).not.toHaveBeenCalled();
    });

    it("lets a refusal or a failure to judge through", async () => {
      const { service, wallet, projectBudgetEnforcementService, userWalletRepository } = setup();
      const refusal = new ProjectBudgetExceededError(["42"], ["project-1"]);
      projectBudgetEnforcementService.enforce.mockRejectedValueOnce(refusal);

      await expect(service.assertWithinBudgets(wallet.id, [createMessage({ owner: wallet.address!, dseq: "42" })])).rejects.toBe(refusal);

      userWalletRepository.findById.mockRejectedValueOnce(new Error("down"));
      await expect(service.assertWithinBudgets(wallet.id, [createMessage({ owner: wallet.address!, dseq: "43" })])).rejects.toThrow("down");
    });

    it("refuses a malformed spending message", async () => {
      const { service, wallet } = setup();

      await expect(service.assertWithinBudgets(wallet.id, [createMessage({ owner: wallet.address!, dseq: "44", amount: "-1" })])).rejects.toMatchObject({
        errorCode: "invalid_deposit"
      });
    });

    it.each([
      { case: "for a request in legacy mode", input: { mode: "legacy" as const }, messages: (owner: string) => [createMessage({ owner, dseq: "45" })] },
      {
        case: "for a job while organizations are off for the wallet's owner",
        input: { mode: "job" as const },
        messages: (owner: string) => [createMessage({ owner, dseq: "46" })]
      },
      { case: "when no message moves funds", input: {}, messages: () => [closeMessage("47")] }
    ])("judges nothing $case", async ({ input, messages }) => {
      const { service, wallet, projectBudgetEnforcementService } = setup(input);

      await service.assertWithinBudgets(wallet.id, messages(wallet.address!));

      expect(projectBudgetEnforcementService.enforce).not.toHaveBeenCalled();
    });

    it("judges nothing for a wallet that belongs to no organization", async () => {
      const { service, userWalletRepository, projectBudgetEnforcementService } = setup();
      const wallet = createUserWallet({ organizationId: null });
      userWalletRepository.findById.mockResolvedValue(wallet);

      await service.assertWithinBudgets(wallet.id, [createMessage({ owner: wallet.address!, dseq: "48" })]);

      expect(projectBudgetEnforcementService.enforce).not.toHaveBeenCalled();
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
        const { service, wallet, deploymentDepositRepository } = setup({ mode: "legacy" });
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

  function depositMessage(input: { owner: string; dseq: string; amount?: string; scope?: Scope; signer?: string }): EncodeObject {
    return {
      typeUrl: `/${MsgAccountDeposit.$type}`,
      value: MsgAccountDeposit.fromPartial({
        signer: input.signer ?? input.owner,
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

  function setup(
    input: {
      mode?: "organization" | "legacy" | "job";
      hasContext?: boolean;
      enabledFlags?: FeatureFlagValue[];
      walletOrganizationType?: OrganizationOutput["type"];
      projectScope?: ProjectScope;
    } = {}
  ) {
    const wallet = createUserWallet({ organizationId: faker.string.uuid() });
    const currentUser: UserOutput = createUser();
    const mode = input.mode ?? "organization";
    const organizationContext =
      mode === "job" ? undefined : createOrganizationContext({ organizationId: wallet.organizationId!, mode, projectScope: input.projectScope });
    const organizationRepository = mock<OrganizationRepository>({
      findById: vi.fn().mockResolvedValue(mock<OrganizationOutput>({ id: wallet.organizationId!, type: input.walletOrganizationType ?? "personal" }))
    });
    const userWalletRepository = mock<UserWalletRepository>({ findById: vi.fn().mockResolvedValue(wallet) });
    const deploymentDepositRepository = mock<DeploymentDepositRepository>({
      findCreateProjectIds: vi.fn().mockResolvedValue(new Map()),
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
    const featureFlagsService = mock<FeatureFlagsService>({ isEnabled: vi.fn((flag: FeatureFlagValue) => !!input.enabledFlags?.includes(flag)) });
    const projectBudgetEnforcementService = mock<ProjectBudgetEnforcementService>({
      enforce: vi.fn(async (_deposits, record) => await record?.()) as ProjectBudgetEnforcementService["enforce"]
    });
    const logger = mock<ReturnType<CreateLogger>>();

    const service = new DeploymentDepositLedgerService(
      userWalletRepository,
      deploymentDepositRepository,
      deploymentSettingRepository,
      projectRepository,
      organizationRepository,
      denomExchangeService,
      jobQueueService,
      txService,
      executionContextService,
      featureFlagsService,
      projectBudgetEnforcementService,
      new Registry([
        [`/${MsgCreateDeployment.$type}`, MsgCreateDeployment as unknown as GeneratedType],
        [`/${MsgAccountDeposit.$type}`, MsgAccountDeposit as unknown as GeneratedType]
      ]),
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
      organizationRepository,
      denomExchangeService,
      jobQueueService,
      txService,
      featureFlagsService,
      projectBudgetEnforcementService,
      logger
    };
  }
});
