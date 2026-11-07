import { createHash, randomInt } from "crypto";
import assert from "http-assert";
import { inject, singleton } from "tsyringe";

import { EmailVerificationCodeRepository } from "@src/auth/repositories/email-verification-code/email-verification-code.repository";
import { Auth0Service } from "@src/auth/services/auth0/auth0.service";
import { TrialActivationJobService } from "@src/billing/services/trial-activation-job/trial-activation-job.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { TxService } from "@src/core/services/tx/tx.service";
import { HardwareRequestClaimService } from "@src/hardware-request/services/hardware-request-claim/hardware-request-claim.service";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { emailVerificationCodeNotification } from "@src/notifications/services/notification-templates/email-verification-code-notification";
import { UserRepository } from "@src/user/repositories/user/user.repository";
import { AccountStatusService } from "@src/user/services/account-status/account-status.service";

const CODE_EXPIRY_MS = 10 * 60 * 1000;
const COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** The account's address can change after a code was sent, and only the address the code reached was proven. */
function isSameAddress(codeEmail: string, accountEmail: string | null): boolean {
  return codeEmail.trim().toLowerCase() === accountEmail?.trim().toLowerCase();
}

@singleton()
export class EmailVerificationCodeService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly emailVerificationCodeRepository: EmailVerificationCodeRepository,
    private readonly auth0Service: Auth0Service,
    private readonly notificationService: NotificationService,
    private readonly userRepository: UserRepository,
    private readonly trialActivationJobService: TrialActivationJobService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger,
    private readonly hardwareRequestClaimService: HardwareRequestClaimService,
    private readonly accountStatusService: AccountStatusService,
    private readonly txService: TxService
  ) {
    this.logger = createLogger({ context: EmailVerificationCodeService.name });
  }

  async sendCode(userInternalId: string): Promise<{ codeSentAt: string }> {
    const user = await this.userRepository.findById(userInternalId);
    assert(user, 404, "User not found");
    assert(user.email, 400, "User has no email address");

    const existing = await this.emailVerificationCodeRepository.findByUserId(userInternalId);
    if (existing) {
      const isWithinCooldown = new Date(existing.expiresAt).getTime() > Date.now() + CODE_EXPIRY_MS - COOLDOWN_MS;
      assert(!isWithinCooldown, 429, "Please wait before requesting a new verification code.");
    }

    const code = randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MS);

    const record = await this.emailVerificationCodeRepository.upsert({
      userId: userInternalId,
      email: user.email,
      code: hashCode(code),
      expiresAt
    });

    try {
      await this.notificationService.createNotification(emailVerificationCodeNotification({ id: userInternalId, email: user.email }, { code }));
    } catch (error) {
      await this.emailVerificationCodeRepository.deleteByUserId(userInternalId);
      this.logger.error({ event: "VERIFICATION_CODE_NOTIFICATION_FAILED", userId: userInternalId, error });
      throw error;
    }

    this.logger.info({ event: "VERIFICATION_CODE_SENT", userId: userInternalId });

    return { codeSentAt: record.createdAt };
  }

  async verifyCode(userInternalId: string, code: string): Promise<void> {
    const [user, record] = await Promise.all([this.userRepository.findById(userInternalId), this.emailVerificationCodeRepository.findByUserId(userInternalId)]);
    assert(user, 404, "User not found");
    assert(user.userId, 400, "User has no Auth0 ID");
    assert(record, 400, "No active verification code. Please request a new one.");
    assert(new Date(record.expiresAt) > new Date(), 400, "Verification code expired. Please request a new one.");

    const attempt = await this.emailVerificationCodeRepository.claimAttempt(record.id, MAX_ATTEMPTS);
    assert(attempt, 429, "Too many attempts. Please request a new code.");
    assert(attempt.code === hashCode(code), 400, "Invalid verification code");

    await this.txService.transaction(async () => {
      const verified = await this.userRepository.updateById(userInternalId, { emailVerified: true }, { returning: true });
      await this.accountStatusService.terminateIfVerifiedEmailWasTerminated(verified);
    });
    await this.trialActivationJobService.schedule(userInternalId).catch(error => {
      this.logger.error({ event: "FAILED_TO_SCHEDULE_TRIAL_ACTIVATION", userId: userInternalId, error });
    });
    if (isSameAddress(record.email, user.email)) {
      await this.hardwareRequestClaimService.claimForVerifiedEmail({ id: user.id, email: record.email }).catch(error => {
        this.logger.error({ event: "FAILED_TO_CLAIM_HARDWARE_REQUESTS", userId: userInternalId, error });
      });
    }

    try {
      await this.auth0Service.markEmailVerified(user.userId);
    } catch (error) {
      this.logger.error({ event: "EMAIL_VERIFIED_MARK_AUTH0_FAILED", userId: userInternalId, auth0UserId: user.userId, error });
      throw error;
    }

    await this.notificationService.confirmAccountEmail(user).catch(error => {
      this.logger.error({ event: "FAILED_TO_CONFIRM_ACCOUNT_EMAIL_ON_CHANNELS", userId: userInternalId, error });
    });

    this.logger.info({ event: "EMAIL_VERIFIED_VIA_CODE", userId: userInternalId });
  }
}
