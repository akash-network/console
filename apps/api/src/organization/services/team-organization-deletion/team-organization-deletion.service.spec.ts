import { createMongoAbility } from "@casl/ability";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { AuthService } from "@src/auth/services/auth.service";
import type { PaymentMethodRepository, UserWalletOutput, UserWalletRepository, WalletSettingRepository } from "@src/billing/repositories";
import type { DeploymentDepositRepository } from "@src/billing/repositories/deployment-deposit/deployment-deposit.repository";
import type { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import type { TxService } from "@src/core/services/tx/tx.service";
import type { OrganizationOutput, OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import type { OrganizationInvitationRepository } from "@src/organization/repositories/organization-invitation/organization-invitation.repository";
import { PERSONAL_ORGANIZATION_ERROR_CODE } from "@src/organization/services/team-organization/team-organization.service";
import {
  TEAM_ORGANIZATION_DELETED_RETRY_OPTIONS,
  TeamOrganizationDeleted
} from "@src/organization/services/team-organization-deleted/team-organization-deleted.handler";
import type { OrganizationContext } from "@src/organization/types/organization-context";
import type {
  AccountDeletionEligibility,
  AccountDeletionEligibilityService
} from "@src/user/services/account-deletion-eligibility/account-deletion-eligibility.service";
import {
  ACTIVE_DEPLOYMENTS_ERROR_CODE,
  FORFEIT_ACKNOWLEDGEMENT_REQUIRED_ERROR_CODE,
  TeamOrganizationDeletionService
} from "./team-organization-deletion.service";

import { createOrganization } from "@test/seeders/organization.seeder";
import { createOrganizationContext } from "@test/seeders/organization-context.seeder";
import { createUser } from "@test/seeders/user.seeder";
import { createOrganizationWallet } from "@test/seeders/user-wallet.seeder";

describe(TeamOrganizationDeletionService.name, () => {
  it("locks the team and its wallet, assesses them and erases the team, all in one transaction", async () => {
    const { service, team, wallet, calls, organizationRepository, invitationRepository, apiKeyRepository, paymentMethodRepository, walletSettingRepository } =
      setup();

    await service.delete(team.id, { acknowledgedForfeitUsd: 0 });

    expect(organizationRepository.findOneByAndLock).toHaveBeenCalledWith({ id: team.id, type: "team", deletedAt: null });
    expect(organizationRepository.updateById).toHaveBeenCalledWith(team.id, { deletedAt: expect.any(Date) });
    const [, { deletedAt }] = organizationRepository.updateById.mock.calls[0] as [string, { deletedAt: Date }];
    expect(invitationRepository.updateBy).toHaveBeenCalledWith({ organizationId: team.id, status: "pending" }, { status: "revoked", revokedAt: deletedAt });
    expect(apiKeyRepository.deleteBy).toHaveBeenCalledWith({ organizationId: team.id });
    expect(paymentMethodRepository.deleteBy).toHaveBeenCalledWith({ organizationId: team.id });
    expect(walletSettingRepository.updateBy).toHaveBeenCalledWith({ walletId: wallet.id }, { autoReloadEnabled: false });
    expect(calls).toEqual([
      "transaction:start",
      "lockOrganization",
      "lockWallet",
      "assessWallet",
      "findPendingDeposits",
      "markDeleted",
      "revokeInvitations",
      "deleteApiKeys",
      "deletePaymentMethods",
      "turnOffAutoReload",
      "cancelReloadCheck",
      "cancelCreditsLowCheck",
      "enqueue",
      "transaction:end"
    ]);
  });

  it("reaches the team's rows past the active organization's scope", async () => {
    const { service, team, invitationRepository, apiKeyRepository, paymentMethodRepository, walletSettingRepository, userWalletRepository, depositRepository } =
      setup();

    await service.delete(team.id, { acknowledgedForfeitUsd: 0 });

    for (const repository of [
      invitationRepository,
      apiKeyRepository,
      paymentMethodRepository,
      walletSettingRepository,
      userWalletRepository,
      depositRepository
    ]) {
      expect(repository.unscoped).toHaveBeenCalledWith("organization-deletion");
    }
  });

  it("cancels the reload and credits-low checks still queued for the team's wallet", async () => {
    const { service, team, wallet, walletReloadJobService } = setup();

    await service.delete(team.id, { acknowledgedForfeitUsd: 0 });

    expect(walletReloadJobService.cancelReloadCheck).toHaveBeenCalledWith({ walletId: wallet.id });
    expect(walletReloadJobService.cancelCreditsLowCheck).toHaveBeenCalledWith({ walletId: wallet.id });
  });

  it("queues the removal of the team's saved cards and the emails to its members, naming who deleted it", async () => {
    const { service, team, user, jobQueueService } = setup();

    await service.delete(team.id, { acknowledgedForfeitUsd: 0 });

    expect(jobQueueService.enqueue).toHaveBeenCalledWith(
      new TeamOrganizationDeleted({ organizationId: team.id, deletedByUserId: user.id }),
      TEAM_ORGANIZATION_DELETED_RETRY_OPTIONS
    );
  });

  it("assesses the team's own wallet as locked, and the deposits the team is still signing", async () => {
    const { service, team, wallet, userWalletRepository, eligibilityService, depositRepository } = setup();

    await service.delete(team.id, { acknowledgedForfeitUsd: 0 });

    expect(userWalletRepository.findOneByAndLock).toHaveBeenCalledWith({ organizationId: team.id });
    expect(eligibilityService.assessWallet).toHaveBeenCalledWith(wallet);
    expect(depositRepository.findPendingDseqsOf).toHaveBeenCalledWith(team.id);
  });

  it("logs the deletion with the credits it forfeited", async () => {
    const { service, team, user, logger } = setup({ balanceUsd: 12.5 });

    await service.delete(team.id, { acknowledgedForfeitUsd: 12.5 });

    expect(logger.info).toHaveBeenCalledWith({ event: "TEAM_ORGANIZATION_DELETED", userId: user.id, organizationId: team.id, forfeitedBalanceUsd: 12.5 });
  });

  it("deletes a team without a wallet, leaving auto reload alone", async () => {
    const { service, team, organizationRepository, walletSettingRepository, walletReloadJobService } = setup({ wallet: null });

    await service.delete(team.id, { acknowledgedForfeitUsd: 0 });

    expect(organizationRepository.updateById).toHaveBeenCalledWith(team.id, { deletedAt: expect.any(Date) });
    expect(walletSettingRepository.updateBy).not.toHaveBeenCalled();
    expect(walletReloadJobService.cancelReloadCheck).not.toHaveBeenCalled();
  });

  it("answers not found for an organization other than the active one, without opening a transaction", async () => {
    const { service, txService } = setup();

    await expect(service.delete(createOrganization().id, { acknowledgedForfeitUsd: 0 })).rejects.toMatchObject({
      status: 404,
      message: "Organization not found"
    });
    expect(txService.transaction).not.toHaveBeenCalled();
  });

  it("answers not found when no organization is active", async () => {
    const { service, team } = setup({ context: null });

    await expect(service.delete(team.id, { acknowledgedForfeitUsd: 0 })).rejects.toMatchObject({ status: 404 });
  });

  it("refuses to delete a personal organization on its own", async () => {
    const { service, team, txService } = setup({ organizationType: "personal" });

    await expect(service.delete(team.id, { acknowledgedForfeitUsd: 0 })).rejects.toMatchObject({
      status: 403,
      message: "A personal organization is deleted only along with its account",
      errorCode: PERSONAL_ORGANIZATION_ERROR_CODE
    });
    expect(txService.transaction).not.toHaveBeenCalled();
  });

  it("refuses a caller whose role may not delete the team", async () => {
    const { service, team, txService } = setup({ canDelete: false });

    await expect(service.delete(team.id, { acknowledgedForfeitUsd: 0 })).rejects.toMatchObject({ status: 403 });
    expect(txService.transaction).not.toHaveBeenCalled();
  });

  it("refuses while deployments of the team are running or still being signed, naming each once", async () => {
    const { service, team, user, organizationRepository, jobQueueService, logger } = setup({ activeDseqs: ["101", "202"], pendingDseqs: ["202", "303"] });

    await expect(service.delete(team.id, { acknowledgedForfeitUsd: 0 })).rejects.toMatchObject({
      status: 409,
      message: "Close the organization's active deployments before deleting it.",
      errorCode: ACTIVE_DEPLOYMENTS_ERROR_CODE,
      data: { activeDeploymentCount: 3, dseqs: ["101", "202", "303"] }
    });
    expect(organizationRepository.updateById).not.toHaveBeenCalled();
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith({
      event: "TEAM_ORGANIZATION_DELETION_BLOCKED",
      userId: user.id,
      organizationId: team.id,
      reason: "active_deployments"
    });
  });

  it("refuses while a deposit the chain does not show yet is still being signed", async () => {
    const { service, team } = setup({ pendingDseqs: ["404"] });

    await expect(service.delete(team.id, { acknowledgedForfeitUsd: 0 })).rejects.toMatchObject({
      status: 409,
      data: { activeDeploymentCount: 1, dseqs: ["404"] }
    });
  });

  it("refuses to forfeit more credits than the owner acknowledged, telling the balance", async () => {
    const { service, team, user, organizationRepository, jobQueueService, logger } = setup({ balanceUsd: 12.5 });

    await expect(service.delete(team.id, { acknowledgedForfeitUsd: 12.49 })).rejects.toMatchObject({
      status: 400,
      message: "Deleting this organization forfeits its remaining credits. Acknowledge the forfeit to continue.",
      errorCode: FORFEIT_ACKNOWLEDGEMENT_REQUIRED_ERROR_CODE,
      data: { balanceUsd: 12.5 }
    });
    expect(organizationRepository.updateById).not.toHaveBeenCalled();
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith({
      event: "TEAM_ORGANIZATION_DELETION_BLOCKED",
      userId: user.id,
      organizationId: team.id,
      reason: "balance_without_forfeit"
    });
  });

  it("deletes a team holding exactly the credits the owner acknowledged", async () => {
    const { service, team, organizationRepository } = setup({ balanceUsd: 12.5 });

    await service.delete(team.id, { acknowledgedForfeitUsd: 12.5 });

    expect(organizationRepository.updateById).toHaveBeenCalledWith(team.id, { deletedAt: expect.any(Date) });
  });

  it("answers not found and writes nothing when the team was deleted in the meantime", async () => {
    const { service, team, organizationRepository, eligibilityService, jobQueueService, logger } = setup({ lockable: false });

    await expect(service.delete(team.id, { acknowledgedForfeitUsd: 0 })).rejects.toMatchObject({ status: 404, message: "Organization not found" });
    expect(eligibilityService.assessWallet).not.toHaveBeenCalled();
    expect(organizationRepository.updateById).not.toHaveBeenCalled();
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });

  function setup(
    input: {
      context?: null;
      organizationType?: OrganizationContext["organizationType"];
      canDelete?: boolean;
      wallet?: null;
      activeDseqs?: string[];
      pendingDseqs?: string[];
      balanceUsd?: number;
      lockable?: boolean;
    } = {}
  ) {
    const calls: string[] = [];
    const track =
      <T>(name: string, result?: T) =>
      async () => {
        calls.push(name);
        return result as T;
      };
    const user = createUser();
    const team = createOrganization({ type: "team" });
    const wallet = createOrganizationWallet({ organizationId: team.id });
    const context =
      input.context === null ? undefined : createOrganizationContext({ organizationId: team.id, organizationType: input.organizationType ?? "team" });
    const ability = createMongoAbility(
      input.canDelete === false ? [] : [{ action: ["update", "delete"], subject: "Organization", conditions: { id: team.id } }]
    );

    const executionContextService = mock<ExecutionContextService>();
    executionContextService.get.calledWith("ORGANIZATION_CONTEXT").mockReturnValue(context);
    executionContextService.get.calledWith("CURRENT_USER").mockReturnValue(user);
    executionContextService.get.calledWith("ABILITY").mockReturnValue(ability);
    const authService = new AuthService(executionContextService);

    const eligibilityService = mock<AccountDeletionEligibilityService>();
    eligibilityService.assessWallet.mockImplementation(
      track<AccountDeletionEligibility>("assessWallet", {
        activeDeploymentDseqs: input.activeDseqs ?? [],
        isTrialing: false,
        forfeitableBalanceUsd: input.balanceUsd ?? 0
      })
    );

    const organizationRepository = mock<OrganizationRepository>();
    organizationRepository.findOneByAndLock.mockImplementation(
      track<OrganizationOutput | undefined>("lockOrganization", input.lockable === false ? undefined : team)
    );
    organizationRepository.updateById.mockImplementation(track("markDeleted"));
    const invitationRepository = mock<OrganizationInvitationRepository>();
    invitationRepository.unscoped.mockReturnValue(invitationRepository);
    invitationRepository.updateBy.mockImplementation(track("revokeInvitations"));
    const apiKeyRepository = mock<ApiKeyRepository>();
    apiKeyRepository.unscoped.mockReturnValue(apiKeyRepository);
    apiKeyRepository.deleteBy.mockImplementation(track("deleteApiKeys"));
    const userWalletRepository = mock<UserWalletRepository>();
    userWalletRepository.unscoped.mockReturnValue(userWalletRepository);
    userWalletRepository.findOneByAndLock.mockImplementation(
      track<UserWalletOutput | undefined>("lockWallet", input.wallet === null ? undefined : (wallet as UserWalletOutput))
    );
    const walletSettingRepository = mock<WalletSettingRepository>();
    walletSettingRepository.unscoped.mockReturnValue(walletSettingRepository);
    walletSettingRepository.updateBy.mockImplementation(track("turnOffAutoReload"));
    const paymentMethodRepository = mock<PaymentMethodRepository>();
    paymentMethodRepository.unscoped.mockReturnValue(paymentMethodRepository);
    paymentMethodRepository.deleteBy.mockImplementation(track("deletePaymentMethods"));
    const depositRepository = mock<DeploymentDepositRepository>();
    depositRepository.unscoped.mockReturnValue(depositRepository);
    depositRepository.findPendingDseqsOf.mockImplementation(track("findPendingDeposits", input.pendingDseqs ?? []));
    const walletReloadJobService = mock<WalletReloadJobService>();
    walletReloadJobService.cancelReloadCheck.mockImplementation(track("cancelReloadCheck"));
    walletReloadJobService.cancelCreditsLowCheck.mockImplementation(track("cancelCreditsLowCheck"));
    const jobQueueService = mock<JobQueueService>();
    jobQueueService.enqueue.mockImplementation(track("enqueue", "job-id"));
    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async callback => {
      calls.push("transaction:start");
      const result = await callback();
      calls.push("transaction:end");
      return result;
    });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new TeamOrganizationDeletionService(
      authService,
      executionContextService,
      eligibilityService,
      organizationRepository,
      invitationRepository,
      apiKeyRepository,
      userWalletRepository,
      walletSettingRepository,
      paymentMethodRepository,
      depositRepository,
      walletReloadJobService,
      jobQueueService,
      txService,
      createLogger
    );

    return {
      service,
      user,
      team,
      wallet,
      calls,
      eligibilityService,
      organizationRepository,
      invitationRepository,
      apiKeyRepository,
      userWalletRepository,
      walletSettingRepository,
      paymentMethodRepository,
      depositRepository,
      walletReloadJobService,
      jobQueueService,
      txService,
      logger
    };
  }
});
