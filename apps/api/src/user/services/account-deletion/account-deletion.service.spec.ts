import { faker } from "@faker-js/faker";
import { createHash } from "crypto";
import { addMinutes, subMinutes, subSeconds } from "date-fns";
import { describe, expect, it, vi } from "vitest";
import { mock, type MockProxy } from "vitest-mock-extended";

import type { UserWalletRepository } from "@src/billing/repositories";
import type { CreateLogger, JobQueueService, TxService } from "@src/core";
import type { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import type { CreateNotificationInput, NotificationService } from "@src/notifications/services/notification/notification.service";
import type {
  AccountDeletionTokenOutput,
  AccountDeletionTokenRepository
} from "@src/user/repositories/account-deletion-token/account-deletion-token.repository";
import type { UserOutput, UserRepository } from "@src/user/repositories/user/user.repository";
import type { UserTemplateRepository } from "@src/user/repositories/user-template/user-template.repository";
import type {
  AccountDeletionEligibility,
  AccountDeletionEligibilityService
} from "@src/user/services/account-deletion-eligibility/account-deletion-eligibility.service";
import { PURGE_DELETED_ACCOUNT_RETRY_OPTIONS, PurgeDeletedAccount } from "@src/user/services/purge-deleted-account/purge-deleted-account.handler";
import type { WorkloadProbeEvidenceRepository } from "@src/workload-abuse/repositories/workload-probe-evidence/workload-probe-evidence.repository";
import { AccountDeletionService, DELETION_LINK_TTL_MINUTES } from "./account-deletion.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createUser } from "@test/seeders/user.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

const DEPLOY_WEB_BASE_URL = "https://console.akash.network";
const CLEAN_ACCOUNT: AccountDeletionEligibility = { activeDeploymentDseqs: [], isTrialing: false, forfeitableBalanceUsd: 0 };

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

describe(AccountDeletionService.name, () => {
  describe("assertEnabledFor", () => {
    it("evaluates the account deletion flag for the given user", () => {
      const { service, featureFlagsService } = setup();

      service.assertEnabledFor("user-1");

      expect(featureFlagsService.isEnabled).toHaveBeenCalledWith(FeatureFlags.ACCOUNT_DELETION, { userId: "user-1" });
    });

    it("answers 404 when the flag is off", () => {
      const { service } = setup({ isFlagEnabled: false });

      expect(() => service.assertEnabledFor("user-1")).toThrow(expect.objectContaining({ status: 404 }));
    });
  });

  describe("initiate", () => {
    it("stores a hash of the link token and emails the link", async () => {
      const { service, user, tokenRepository, notificationService } = setup();

      await service.initiate(user, { forfeitAcknowledged: false });

      const confirmUrl = sentConfirmUrl(notificationService);
      const token = new URLSearchParams(confirmUrl.hash.slice(1)).get("token")!;
      expect(`${confirmUrl.origin}${confirmUrl.pathname}${confirmUrl.search}`).toBe(`${DEPLOY_WEB_BASE_URL}/user/confirm-delete`);
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(tokenRepository.replaceForUser).toHaveBeenCalledWith({
        userId: user.id,
        tokenHash: sha256(token),
        acknowledgedForfeitUsd: 0,
        expiresAt: expect.any(Date)
      });
    });

    it("makes the link expire after the deletion link lifetime", async () => {
      const { service, user, tokenRepository } = setup();
      const before = new Date();

      await service.initiate(user, { forfeitAcknowledged: false });

      const { expiresAt } = tokenRepository.replaceForUser.mock.calls[0][0];
      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(addMinutes(before, DELETION_LINK_TTL_MINUTES).getTime());
      expect(expiresAt.getTime()).toBeLessThanOrEqual(addMinutes(new Date(), DELETION_LINK_TTL_MINUTES).getTime());
    });

    it("sends the email to the user who asked", async () => {
      const { service, user, notificationService } = setup();

      await service.initiate(user, { forfeitAcknowledged: false });

      expect(notificationService.createNotification).toHaveBeenCalledWith(expect.objectContaining({ user: { id: user.id, email: user.email } }));
    });

    it("records who started the deletion and from where", async () => {
      const { service, user, logger, analyticsService } = setup({ eligibility: { ...CLEAN_ACCOUNT, isTrialing: true } });

      await service.initiate(user, { forfeitAcknowledged: false, ip: "203.0.113.7", userAgent: "Mozilla/5.0" });

      expect(logger.info).toHaveBeenCalledWith({
        event: "ACCOUNT_DELETION_INITIATED",
        userId: user.id,
        ip: "203.0.113.7",
        userAgent: "Mozilla/5.0",
        forfeitAcknowledged: false
      });
      expect(analyticsService.track).toHaveBeenCalledWith(user.id, "account_deletion_started", {
        forfeit_acknowledged: false,
        had_balance: false,
        is_trial: true
      });
    });

    it("refuses an account with active deployments and names them", async () => {
      const { service, user, tokenRepository, notificationService, analyticsService, logger } = setup({
        eligibility: { ...CLEAN_ACCOUNT, activeDeploymentDseqs: ["101", "202"] }
      });

      await expect(service.initiate(user, { forfeitAcknowledged: true })).rejects.toMatchObject({
        status: 409,
        errorCode: "active_deployments",
        data: { activeDeploymentCount: 2, dseqs: ["101", "202"] }
      });

      expect(tokenRepository.replaceForUser).not.toHaveBeenCalled();
      expect(notificationService.createNotification).not.toHaveBeenCalled();
      expect(analyticsService.track).toHaveBeenCalledWith(user.id, "account_deletion_blocked", { reason: "active_deployments" });
      expect(logger.info).toHaveBeenCalledWith({ event: "ACCOUNT_DELETION_BLOCKED", userId: user.id, reason: "active_deployments" });
    });

    it("refuses an account with credits until the forfeit is acknowledged", async () => {
      const { service, user, tokenRepository, analyticsService } = setup({ eligibility: { ...CLEAN_ACCOUNT, forfeitableBalanceUsd: 12.5 } });

      await expect(service.initiate(user, { forfeitAcknowledged: false })).rejects.toMatchObject({
        status: 400,
        errorCode: "forfeit_acknowledgement_required",
        data: { balanceUsd: 12.5 }
      });

      expect(tokenRepository.replaceForUser).not.toHaveBeenCalled();
      expect(analyticsService.track).toHaveBeenCalledWith(user.id, "account_deletion_blocked", { reason: "balance_without_forfeit" });
    });

    it("sends the link for an account with credits once the forfeit is acknowledged, naming the amount", async () => {
      const { service, user, tokenRepository, notificationService, analyticsService } = setup({
        eligibility: { ...CLEAN_ACCOUNT, forfeitableBalanceUsd: 12.5 }
      });

      await service.initiate(user, { forfeitAcknowledged: true });

      expect(tokenRepository.replaceForUser).toHaveBeenCalledWith(expect.objectContaining({ acknowledgedForfeitUsd: 12.5 }));
      expect(sentNotification(notificationService).payload.description).toContain("$12.50");
      expect(analyticsService.track).toHaveBeenCalledWith(user.id, "account_deletion_started", {
        forfeit_acknowledged: true,
        had_balance: true,
        is_trial: false
      });
    });

    it("acknowledges nothing to forfeit for an account without credits, whatever the request says", async () => {
      const { service, user, tokenRepository } = setup();

      await service.initiate(user, { forfeitAcknowledged: true });

      expect(tokenRepository.replaceForUser).toHaveBeenCalledWith(expect.objectContaining({ acknowledgedForfeitUsd: 0 }));
    });

    it("refuses another link within a minute of the last one and says when to retry", async () => {
      const { service, user, eligibilityService, notificationService } = setup({ existingToken: { createdAt: subSeconds(new Date(), 10) } });

      const error = await service.initiate(user, { forfeitAcknowledged: false }).catch(error => error);

      expect(error).toMatchObject({ status: 429, errorCode: "account_deletion_cooldown" });
      expect(Number(error.headers["Retry-After"])).toBeGreaterThanOrEqual(49);
      expect(Number(error.headers["Retry-After"])).toBeLessThanOrEqual(50);
      expect(eligibilityService.assess).not.toHaveBeenCalled();
      expect(notificationService.createNotification).not.toHaveBeenCalled();
    });

    it("sends a new link once the cooldown has passed", async () => {
      const { service, user, notificationService } = setup({ existingToken: { createdAt: subSeconds(new Date(), 61) } });

      await service.initiate(user, { forfeitAcknowledged: false });

      expect(notificationService.createNotification).toHaveBeenCalledTimes(1);
    });

    it("still reports the email failure when withdrawing the link fails too", async () => {
      const failure = new Error("notifications unavailable");
      const cleanupFailure = new Error("database unavailable");
      const { service, user, tokenRepository, logger } = setup({ emailFails: failure });
      tokenRepository.deleteByUserId.mockRejectedValue(cleanupFailure);

      await expect(service.initiate(user, { forfeitAcknowledged: false })).rejects.toBe(failure);

      expect(logger.error).toHaveBeenCalledWith({ event: "ACCOUNT_DELETION_EMAIL_FAILED", userId: user.id, error: failure });
      expect(logger.error).toHaveBeenCalledWith({ event: "ACCOUNT_DELETION_TOKEN_CLEANUP_FAILED", userId: user.id, error: cleanupFailure });
    });

    it("withdraws the link and reports the failure when the email cannot be sent", async () => {
      const failure = new Error("notifications unavailable");
      const { service, user, tokenRepository, logger, analyticsService } = setup({ emailFails: failure });

      await expect(service.initiate(user, { forfeitAcknowledged: false })).rejects.toBe(failure);

      expect(tokenRepository.deleteByUserId).toHaveBeenCalledWith(user.id);
      expect(logger.error).toHaveBeenCalledWith({ event: "ACCOUNT_DELETION_EMAIL_FAILED", userId: user.id, error: failure });
      expect(analyticsService.track).not.toHaveBeenCalledWith(user.id, "account_deletion_started", expect.anything());
    });
  });

  describe("confirm", () => {
    it("deletes the account the link was sent for and queues the cleanup outside the database", async () => {
      const wallet = createUserWallet();
      const { service, user, userRepository, userTemplateRepository, workloadProbeEvidenceRepository, jobQueueService, txService } = setup({
        wallet,
        storedToken: {}
      });

      await service.confirm({ token: "link-token" });

      expect(txService.transaction).toHaveBeenCalledTimes(1);
      expect(userRepository.findOneByAndLock).toHaveBeenCalledWith({ id: user.id });
      expect(userTemplateRepository.deleteAllOwnedBy).toHaveBeenCalledWith(user.userId);
      expect(workloadProbeEvidenceRepository.deleteByWalletId).toHaveBeenCalledWith(wallet.id);
      expect(userRepository.deleteById).toHaveBeenCalledWith(user.id);
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(
        new PurgeDeletedAccount({ userId: user.id, auth0UserId: user.userId, stripeCustomerId: user.stripeCustomerId }),
        PURGE_DELETED_ACCOUNT_RETRY_OPTIONS
      );
    });

    it("looks the link up by the hash of its token", async () => {
      const { service, tokenRepository } = setup({ storedToken: {} });

      await service.confirm({ token: "link-token" });

      expect(tokenRepository.findByTokenHash).toHaveBeenCalledWith(sha256("link-token"));
    });

    it("reports the confirmation once the account is erased", async () => {
      const { service, user, analyticsService, logger } = setup({ storedToken: {}, eligibility: { ...CLEAN_ACCOUNT, isTrialing: true } });

      await service.confirm({ token: "link-token" });

      expect(analyticsService.track).toHaveBeenCalledWith(user.id, "account_deletion_confirmed", { had_balance: false, is_trial: true });
      expect(logger.info).toHaveBeenCalledWith({ event: "ACCOUNT_DELETION_CONFIRMED", userId: user.id });
    });

    it("skips the template cleanup for a user without an Auth0 id", async () => {
      const { service, user, userTemplateRepository, jobQueueService } = setup({ storedToken: {}, user: { userId: null } });

      await service.confirm({ token: "link-token" });

      expect(userTemplateRepository.deleteAllOwnedBy).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(
        new PurgeDeletedAccount({ userId: user.id, auth0UserId: null, stripeCustomerId: user.stripeCustomerId }),
        PURGE_DELETED_ACCOUNT_RETRY_OPTIONS
      );
    });

    it("skips the probe evidence cleanup for a user without a wallet", async () => {
      const { service, workloadProbeEvidenceRepository, userRepository } = setup({ storedToken: {}, wallet: null });

      await service.confirm({ token: "link-token" });

      expect(workloadProbeEvidenceRepository.deleteByWalletId).not.toHaveBeenCalled();
      expect(userRepository.deleteById).toHaveBeenCalled();
    });

    it("does nothing when a concurrent confirmation already deleted the user", async () => {
      const { service, userRepository, jobQueueService, analyticsService, logger } = setup({ storedToken: {}, lockedUserGone: true });

      await service.confirm({ token: "link-token" });

      expect(userRepository.deleteById).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
      expect(analyticsService.track).not.toHaveBeenCalledWith(expect.anything(), "account_deletion_confirmed", expect.anything());
      expect(logger.info).not.toHaveBeenCalledWith(expect.objectContaining({ event: "ACCOUNT_DELETION_CONFIRMED" }));
    });

    it("answers 404 when the flag is off for the user the link belongs to", async () => {
      const { service, user, featureFlagsService, userRepository } = setup({ storedToken: {}, isFlagEnabled: false });

      await expect(service.confirm({ token: "link-token" })).rejects.toMatchObject({ status: 404 });

      expect(featureFlagsService.isEnabled).toHaveBeenCalledWith(FeatureFlags.ACCOUNT_DELETION, { userId: user.id });
      expect(userRepository.deleteById).not.toHaveBeenCalled();
    });

    it("refuses a token no link was issued for and logs the attempt", async () => {
      const { service, userRepository, logger } = setup({ storedToken: null });

      await expect(service.confirm({ token: "guessed-token", ip: "203.0.113.7" })).rejects.toMatchObject({ status: 400, errorCode: "invalid_deletion_token" });

      expect(logger.warn).toHaveBeenCalledWith({ event: "ACCOUNT_DELETION_TOKEN_INVALID", reason: "missing", ip: "203.0.113.7" });
      expect(userRepository.deleteById).not.toHaveBeenCalled();
    });

    it("refuses a link whose user is already gone", async () => {
      const { service, userRepository } = setup({ storedToken: {}, userGone: true });

      await expect(service.confirm({ token: "link-token" })).rejects.toMatchObject({ status: 400, errorCode: "invalid_deletion_token" });

      expect(userRepository.deleteById).not.toHaveBeenCalled();
    });

    it("refuses an expired link and logs the attempt", async () => {
      const { service, user, userRepository, logger } = setup({ storedToken: { expiresAt: subMinutes(new Date(), 1) } });

      await expect(service.confirm({ token: "link-token", ip: "203.0.113.7" })).rejects.toMatchObject({ status: 400, errorCode: "expired_deletion_token" });

      expect(logger.warn).toHaveBeenCalledWith({ event: "ACCOUNT_DELETION_TOKEN_INVALID", reason: "expired", userId: user.id, ip: "203.0.113.7" });
      expect(userRepository.deleteById).not.toHaveBeenCalled();
    });

    it("refuses while the account still has active deployments", async () => {
      const { service, userRepository, analyticsService, user } = setup({ storedToken: {}, eligibility: { ...CLEAN_ACCOUNT, activeDeploymentDseqs: ["101"] } });

      await expect(service.confirm({ token: "link-token" })).rejects.toMatchObject({ status: 409, errorCode: "active_deployments" });

      expect(userRepository.deleteById).not.toHaveBeenCalled();
      expect(analyticsService.track).toHaveBeenCalledWith(user.id, "account_deletion_blocked", { reason: "active_deployments" });
    });

    it("refuses when credits appeared after a link that did not acknowledge a forfeit", async () => {
      const { service, user, userRepository, analyticsService } = setup({
        storedToken: { acknowledgedForfeitUsd: 0 },
        eligibility: { ...CLEAN_ACCOUNT, forfeitableBalanceUsd: 5 }
      });

      await expect(service.confirm({ token: "link-token" })).rejects.toMatchObject({
        status: 409,
        errorCode: "forfeit_acknowledgement_required",
        data: { balanceUsd: 5 }
      });

      expect(userRepository.deleteById).not.toHaveBeenCalled();
      expect(analyticsService.track).toHaveBeenCalledWith(user.id, "account_deletion_blocked", { reason: "balance_without_forfeit" });
    });

    it("refuses when the credits grew past the amount the link acknowledged", async () => {
      const { service, userRepository } = setup({ storedToken: { acknowledgedForfeitUsd: 5 }, eligibility: { ...CLEAN_ACCOUNT, forfeitableBalanceUsd: 500 } });

      await expect(service.confirm({ token: "link-token" })).rejects.toMatchObject({ status: 409, errorCode: "forfeit_acknowledgement_required" });

      expect(userRepository.deleteById).not.toHaveBeenCalled();
    });

    it("deletes an account whose credits shrank since the link acknowledged them", async () => {
      const { service, user, userRepository } = setup({
        storedToken: { acknowledgedForfeitUsd: 5 },
        eligibility: { ...CLEAN_ACCOUNT, forfeitableBalanceUsd: 3 }
      });

      await service.confirm({ token: "link-token" });

      expect(userRepository.deleteById).toHaveBeenCalledWith(user.id);
    });

    it("deletes an account with credits when its link acknowledged the forfeit", async () => {
      const { service, user, userRepository, analyticsService } = setup({
        storedToken: { acknowledgedForfeitUsd: 5 },
        eligibility: { ...CLEAN_ACCOUNT, forfeitableBalanceUsd: 5 }
      });

      await service.confirm({ token: "link-token" });

      expect(userRepository.deleteById).toHaveBeenCalledWith(user.id);
      expect(analyticsService.track).toHaveBeenCalledWith(user.id, "account_deletion_confirmed", { had_balance: true, is_trial: false });
    });
  });

  it("creates the logger with the service context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: AccountDeletionService.name });
  });

  function sentNotification(notificationService: MockProxy<NotificationService>): CreateNotificationInput {
    return notificationService.createNotification.mock.calls[0][0];
  }

  function sentConfirmUrl(notificationService: MockProxy<NotificationService>): URL {
    return new URL(sentNotification(notificationService).payload.actions![0].url);
  }

  function setup(
    input: {
      user?: Partial<UserOutput>;
      wallet?: ReturnType<typeof createUserWallet> | null;
      eligibility?: AccountDeletionEligibility;
      isFlagEnabled?: boolean;
      existingToken?: Partial<AccountDeletionTokenOutput>;
      storedToken?: Partial<AccountDeletionTokenOutput> | null;
      userGone?: boolean;
      lockedUserGone?: boolean;
      emailFails?: Error;
    } = {}
  ) {
    const user = createUser(input.user);
    const wallet = input.wallet === null ? undefined : input.wallet ?? createUserWallet({ userId: user.id });
    const tokenFor = (overrides: Partial<AccountDeletionTokenOutput>): AccountDeletionTokenOutput => ({
      id: faker.string.uuid(),
      userId: user.id,
      tokenHash: sha256("link-token"),
      acknowledgedForfeitUsd: 0,
      expiresAt: addMinutes(new Date(), 10),
      createdAt: new Date(),
      ...overrides
    });

    const tokenRepository = mock<AccountDeletionTokenRepository>();
    tokenRepository.findByUserId.mockResolvedValue(input.existingToken ? tokenFor(input.existingToken) : undefined);
    tokenRepository.findByTokenHash.mockResolvedValue(input.storedToken ? tokenFor(input.storedToken) : undefined);
    tokenRepository.replaceForUser.mockImplementation(async token => tokenFor(token));
    tokenRepository.deleteByUserId.mockResolvedValue(undefined);

    const eligibilityService = mock<AccountDeletionEligibilityService>();
    eligibilityService.assess.mockResolvedValue(input.eligibility ?? CLEAN_ACCOUNT);

    const userRepository = mock<UserRepository>();
    userRepository.findById.mockResolvedValue(input.userGone ? undefined : user);
    userRepository.findOneByAndLock.mockResolvedValue(input.lockedUserGone ? undefined : user);

    const userWalletRepository = mock<UserWalletRepository>();
    userWalletRepository.findOneByUserId.mockResolvedValue(wallet);

    const userTemplateRepository = mock<UserTemplateRepository>();
    const workloadProbeEvidenceRepository = mock<WorkloadProbeEvidenceRepository>();

    const notificationService = mock<NotificationService>();
    if (input.emailFails) notificationService.createNotification.mockRejectedValue(input.emailFails);

    const jobQueueService = mock<JobQueueService>();
    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async callback => await callback());

    const analyticsService = mock<AnalyticsService>();
    const featureFlagsService = mock<FeatureFlagsService>();
    featureFlagsService.isEnabled.mockReturnValue(input.isFlagEnabled ?? true);

    const deploymentConfig = mockConfigService<DeploymentConfigService>({ DEPLOY_WEB_BASE_URL });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new AccountDeletionService(
      tokenRepository,
      eligibilityService,
      userRepository,
      userWalletRepository,
      userTemplateRepository,
      workloadProbeEvidenceRepository,
      notificationService,
      jobQueueService,
      txService,
      analyticsService,
      featureFlagsService,
      deploymentConfig,
      createLogger
    );

    return {
      service,
      user,
      tokenRepository,
      eligibilityService,
      userRepository,
      userTemplateRepository,
      workloadProbeEvidenceRepository,
      notificationService,
      jobQueueService,
      txService,
      analyticsService,
      featureFlagsService,
      logger,
      createLogger
    };
  }
});
