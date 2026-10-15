import createError from "http-errors";
import { inject, singleton } from "tsyringe";

import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { AuthService } from "@src/auth/services/auth.service";
import { PaymentMethodRepository, type UserWalletOutput, UserWalletRepository, WalletSettingRepository } from "@src/billing/repositories";
import { DeploymentDepositRepository } from "@src/billing/repositories/deployment-deposit/deployment-deposit.repository";
import { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import { TxService } from "@src/core/services/tx/tx.service";
import { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import { OrganizationInvitationRepository } from "@src/organization/repositories/organization-invitation/organization-invitation.repository";
import { PERSONAL_ORGANIZATION_ERROR_CODE } from "@src/organization/services/team-organization/team-organization.service";
import {
  TEAM_ORGANIZATION_DELETED_RETRY_OPTIONS,
  TeamOrganizationDeleted
} from "@src/organization/services/team-organization-deleted/team-organization-deleted.handler";
import { AccountDeletionEligibilityService } from "@src/user/services/account-deletion-eligibility/account-deletion-eligibility.service";

export const ACTIVE_DEPLOYMENTS_ERROR_CODE = "active_deployments";
export const FORFEIT_ACKNOWLEDGEMENT_REQUIRED_ERROR_CODE = "forfeit_acknowledgement_required";

type BlockReason = "active_deployments" | "balance_without_forfeit";

type TeamEligibility = { activeDeploymentDseqs: string[]; forfeitableBalanceUsd: number };

@singleton()
export class TeamOrganizationDeletionService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly authService: AuthService,
    private readonly executionContextService: ExecutionContextService,
    private readonly eligibilityService: AccountDeletionEligibilityService,
    private readonly organizationRepository: OrganizationRepository,
    private readonly invitationRepository: OrganizationInvitationRepository,
    private readonly apiKeyRepository: ApiKeyRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly walletSettingRepository: WalletSettingRepository,
    private readonly paymentMethodRepository: PaymentMethodRepository,
    private readonly deploymentDepositRepository: DeploymentDepositRepository,
    private readonly walletReloadJobService: WalletReloadJobService,
    private readonly jobQueueService: JobQueueService,
    private readonly txService: TxService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: TeamOrganizationDeletionService.name });
  }

  async delete(id: string, { acknowledgedForfeitUsd }: { acknowledgedForfeitUsd: number }): Promise<void> {
    this.#assertActiveTeam(id);
    this.authService.throwUnlessCan("delete", "Organization", { id });
    const { id: userId } = this.authService.currentUser;

    const { forfeitableBalanceUsd } = await this.txService.transaction(async () => {
      const wallet = await this.#lockTeam(id);
      const eligibility = await this.#assess(id, wallet);
      this.#assertDeletable(userId, id, eligibility, acknowledgedForfeitUsd);
      await this.#erase(id, { wallet, deletedByUserId: userId });

      return eligibility;
    });

    this.#logger.info({ event: "TEAM_ORGANIZATION_DELETED", userId, organizationId: id, forfeitedBalanceUsd: forfeitableBalanceUsd });
  }

  /** Locks the team, which a deposit being recorded holds, then its wallet, which a settling card payment holds, so the assessment sees what either commits. */
  async #lockTeam(id: string): Promise<UserWalletOutput | undefined> {
    if (!(await this.organizationRepository.findOneByAndLock({ id, type: "team", deletedAt: null }))) {
      throw createError(404, "Organization not found");
    }

    return await this.userWalletRepository.unscoped("organization-deletion").findOneByAndLock({ organizationId: id });
  }

  /** A deposit still being signed counts as a running deployment, since the chain may include it after the team is gone. */
  async #assess(id: string, wallet: UserWalletOutput | undefined): Promise<TeamEligibility> {
    const [{ activeDeploymentDseqs, forfeitableBalanceUsd }, pendingDseqs] = await Promise.all([
      this.eligibilityService.assessWallet(wallet),
      this.deploymentDepositRepository.unscoped("organization-deletion").findPendingDseqsOf(id)
    ]);

    return { activeDeploymentDseqs: [...new Set([...activeDeploymentDseqs, ...pendingDseqs])], forfeitableBalanceUsd };
  }

  #assertDeletable(userId: string, id: string, { activeDeploymentDseqs, forfeitableBalanceUsd }: TeamEligibility, acknowledgedForfeitUsd: number): void {
    if (activeDeploymentDseqs.length > 0) {
      this.#reportBlocked(userId, id, "active_deployments");
      throw createError(409, "Close the organization's active deployments before deleting it.", {
        errorCode: ACTIVE_DEPLOYMENTS_ERROR_CODE,
        data: { activeDeploymentCount: activeDeploymentDseqs.length, dseqs: activeDeploymentDseqs }
      });
    }

    if (forfeitableBalanceUsd > acknowledgedForfeitUsd) {
      this.#reportBlocked(userId, id, "balance_without_forfeit");
      throw createError(400, "Deleting this organization forfeits its remaining credits. Acknowledge the forfeit to continue.", {
        errorCode: FORFEIT_ACKNOWLEDGEMENT_REQUIRED_ERROR_CODE,
        data: { balanceUsd: forfeitableBalanceUsd }
      });
    }
  }

  /** Marks the row deleted rather than removing it, so what the team paid and deployed stays on record. */
  async #erase(
    organizationId: string,
    { wallet, deletedByUserId }: { wallet: Pick<UserWalletOutput, "id"> | undefined; deletedByUserId: string }
  ): Promise<void> {
    const deletedAt = new Date();

    await this.organizationRepository.updateById(organizationId, { deletedAt });
    await this.invitationRepository
      .unscoped("organization-deletion")
      .updateBy({ organizationId, status: "pending" }, { status: "revoked", revokedAt: deletedAt });
    await this.apiKeyRepository.unscoped("organization-deletion").deleteBy({ organizationId });
    await this.paymentMethodRepository.unscoped("organization-deletion").deleteBy({ organizationId });
    if (wallet) await this.#turnOffAutoReload(wallet.id);
    await this.jobQueueService.enqueue(new TeamOrganizationDeleted({ organizationId, deletedByUserId }), TEAM_ORGANIZATION_DELETED_RETRY_OPTIONS);
  }

  async #turnOffAutoReload(walletId: number): Promise<void> {
    await this.walletSettingRepository.unscoped("organization-deletion").updateBy({ walletId }, { autoReloadEnabled: false });
    await this.walletReloadJobService.cancelReloadCheck({ walletId });
    await this.walletReloadJobService.cancelCreditsLowCheck({ walletId });
  }

  #assertActiveTeam(id: string): void {
    const context = this.executionContextService.get("ORGANIZATION_CONTEXT");

    if (context?.organizationId !== id) {
      throw createError(404, "Organization not found");
    }

    if (context.organizationType === "personal") {
      throw createError(403, "A personal organization is deleted only along with its account", { errorCode: PERSONAL_ORGANIZATION_ERROR_CODE });
    }
  }

  #reportBlocked(userId: string, organizationId: string, reason: BlockReason): void {
    this.#logger.info({ event: "TEAM_ORGANIZATION_DELETION_BLOCKED", userId, organizationId, reason });
  }
}
