import { createHash, randomBytes } from "crypto";
import { addMinutes, differenceInSeconds } from "date-fns";
import assert from "http-assert";
import createError from "http-errors";
import { inject, singleton } from "tsyringe";

import { UserWalletRepository } from "@src/billing/repositories";
import { type CreateLogger, JobQueueService, LOGGER_FACTORY, TxService } from "@src/core";
import { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { accountDeletionConfirmationNotification } from "@src/notifications/services/notification-templates/account-deletion-confirmation-notification";
import { AccountDeletionTokenRepository } from "@src/user/repositories/account-deletion-token/account-deletion-token.repository";
import { type UserOutput, UserRepository } from "@src/user/repositories/user/user.repository";
import { UserTemplateRepository } from "@src/user/repositories/user-template/user-template.repository";
import {
  type AccountDeletionEligibility,
  AccountDeletionEligibilityService
} from "@src/user/services/account-deletion-eligibility/account-deletion-eligibility.service";
import { PURGE_DELETED_ACCOUNT_RETRY_OPTIONS, PurgeDeletedAccount } from "@src/user/services/purge-deleted-account/purge-deleted-account.handler";
import { WorkloadProbeEvidenceRepository } from "@src/workload-abuse/repositories/workload-probe-evidence/workload-probe-evidence.repository";

export const DELETION_LINK_TTL_MINUTES = 15;
export const DELETION_LINK_RESEND_COOLDOWN_SECONDS = 60;

type BlockReason = "active_deployments" | "balance_without_forfeit";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

@singleton()
export class AccountDeletionService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly tokenRepository: AccountDeletionTokenRepository,
    private readonly eligibilityService: AccountDeletionEligibilityService,
    private readonly userRepository: UserRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly userTemplateRepository: UserTemplateRepository,
    private readonly workloadProbeEvidenceRepository: WorkloadProbeEvidenceRepository,
    private readonly notificationService: NotificationService,
    private readonly jobQueueService: JobQueueService,
    private readonly txService: TxService,
    private readonly analyticsService: AnalyticsService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly deploymentConfig: DeploymentConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: AccountDeletionService.name });
  }

  assertEnabledFor(userId?: string): void {
    assert(this.featureFlagsService.isEnabled(FeatureFlags.ACCOUNT_DELETION, { userId }), 404);
  }

  async initiate(user: UserOutput, input: { forfeitAcknowledged: boolean; ip?: string; userAgent?: string }): Promise<void> {
    await this.assertResendCooldownElapsed(user.id);

    const eligibility = await this.eligibilityService.assess(user.id);
    this.assertNoActiveDeployments(user.id, eligibility);

    if (eligibility.forfeitableBalanceUsd > 0 && !input.forfeitAcknowledged) {
      this.reportBlocked(user.id, "balance_without_forfeit");
      throw createError(400, "Deleting this account forfeits its remaining credits. Acknowledge the forfeit to continue.", {
        errorCode: "forfeit_acknowledgement_required",
        data: { balanceUsd: eligibility.forfeitableBalanceUsd }
      });
    }

    const token = randomBytes(32).toString("base64url");
    await this.tokenRepository.replaceForUser({
      userId: user.id,
      tokenHash: hashToken(token),
      forfeitAcknowledged: input.forfeitAcknowledged,
      expiresAt: addMinutes(new Date(), DELETION_LINK_TTL_MINUTES)
    });
    await this.sendConfirmationEmail(user, token, eligibility.forfeitableBalanceUsd);

    this.logger.info({
      event: "ACCOUNT_DELETION_INITIATED",
      userId: user.id,
      ip: input.ip,
      userAgent: input.userAgent,
      forfeitAcknowledged: input.forfeitAcknowledged
    });
    this.analyticsService.track(user.id, "account_deletion_started", {
      forfeit_acknowledged: input.forfeitAcknowledged,
      had_balance: eligibility.forfeitableBalanceUsd > 0,
      is_trial: eligibility.isTrialing
    });
  }

  async confirm(input: { token: string; ip?: string }): Promise<void> {
    const record = await this.tokenRepository.findByTokenHash(hashToken(input.token));
    this.assertEnabledFor(record?.userId);

    const user = record && (await this.userRepository.findById(record.userId));

    if (!record || !user) {
      this.logger.warn({ event: "ACCOUNT_DELETION_TOKEN_INVALID", reason: "missing", ip: input.ip });
      throw createError(400, "This deletion link is not valid. Request a new one from your account settings.", { errorCode: "invalid_deletion_token" });
    }

    if (record.expiresAt <= new Date()) {
      this.logger.warn({ event: "ACCOUNT_DELETION_TOKEN_INVALID", reason: "expired", userId: user.id, ip: input.ip });
      throw createError(400, "This deletion link has expired. Request a new one from your account settings.", { errorCode: "expired_deletion_token" });
    }

    const eligibility = await this.eligibilityService.assess(user.id);
    this.assertNoActiveDeployments(user.id, eligibility);

    if (eligibility.forfeitableBalanceUsd > 0 && !record.forfeitAcknowledged) {
      this.reportBlocked(user.id, "balance_without_forfeit");
      throw createError(409, "This account has credits that were not there when the deletion was requested. Request a new deletion link.", {
        errorCode: "forfeit_acknowledgement_required",
        data: { balanceUsd: eligibility.forfeitableBalanceUsd }
      });
    }

    this.analyticsService.track(user.id, "account_deletion_confirmed", {
      had_balance: eligibility.forfeitableBalanceUsd > 0,
      is_trial: eligibility.isTrialing
    });
    await this.eraseAccount(user);
    this.logger.info({ event: "ACCOUNT_DELETION_CONFIRMED", userId: user.id });
  }

  private async assertResendCooldownElapsed(userId: string): Promise<void> {
    const existing = await this.tokenRepository.findByUserId(userId);
    if (!existing) return;

    const secondsUntilResend = DELETION_LINK_RESEND_COOLDOWN_SECONDS - differenceInSeconds(new Date(), existing.createdAt);
    if (secondsUntilResend <= 0) return;

    throw createError(429, "A deletion link was just sent. Check your email or wait a minute before requesting another.", {
      errorCode: "account_deletion_cooldown",
      headers: { "Retry-After": String(secondsUntilResend) }
    });
  }

  private assertNoActiveDeployments(userId: string, eligibility: AccountDeletionEligibility): void {
    const { activeDeploymentDseqs } = eligibility;
    if (activeDeploymentDseqs.length === 0) return;

    this.reportBlocked(userId, "active_deployments");
    throw createError(409, "Close your active deployments before deleting your account.", {
      errorCode: "active_deployments",
      data: { activeDeploymentCount: activeDeploymentDseqs.length, dseqs: activeDeploymentDseqs }
    });
  }

  private reportBlocked(userId: string, reason: BlockReason): void {
    this.logger.info({ event: "ACCOUNT_DELETION_BLOCKED", userId, reason });
    this.analyticsService.track(userId, "account_deletion_blocked", { reason });
  }

  private async sendConfirmationEmail(user: UserOutput, token: string, forfeitedBalanceUsd: number): Promise<void> {
    const confirmUrl = `${this.deploymentConfig.get("DEPLOY_WEB_BASE_URL")}/user/confirm-delete?token=${token}`;

    try {
      await this.notificationService.createNotification(
        accountDeletionConfirmationNotification(user, { confirmUrl, expiresInMinutes: DELETION_LINK_TTL_MINUTES, forfeitedBalanceUsd })
      );
    } catch (error) {
      await this.tokenRepository.deleteByUserId(user.id);
      this.logger.error({ event: "ACCOUNT_DELETION_EMAIL_FAILED", userId: user.id, error });
      throw error;
    }
  }

  /** Templates and favorites key on the Auth0 id and probe evidence on the wallet id, so no foreign key cascades them with the user row. */
  private async eraseAccount(user: UserOutput): Promise<void> {
    await this.txService.transaction(async () => {
      const lockedUser = await this.userRepository.findOneByAndLock({ id: user.id });
      if (!lockedUser) return;

      const wallet = await this.userWalletRepository.findOneByUserId(user.id);

      if (lockedUser.userId) await this.userTemplateRepository.deleteAllOwnedBy(lockedUser.userId);
      if (wallet) await this.workloadProbeEvidenceRepository.deleteByWalletId(wallet.id);
      await this.userRepository.deleteById(user.id);

      await this.jobQueueService.enqueue(
        new PurgeDeletedAccount({ userId: user.id, auth0UserId: lockedUser.userId, stripeCustomerId: lockedUser.stripeCustomerId }),
        PURGE_DELETED_ACCOUNT_RETRY_OPTIONS
      );
    });
  }
}
