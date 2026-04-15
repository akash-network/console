import { createHash, randomInt } from "crypto";
import assert from "http-assert";
import { singleton } from "tsyringe";

import { EmailVerificationCodeRepository } from "@src/auth/repositories/email-verification-code/email-verification-code.repository";
import { Auth0Service } from "@src/auth/services/auth0/auth0.service";
import { WithTransaction } from "@src/core";
import { LoggerService } from "@src/core/providers/logging.provider";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { emailVerificationCodeNotification } from "@src/notifications/services/notification-templates/email-verification-code-notification";
import { UserRepository } from "@src/user/repositories/user/user.repository";

const CODE_EXPIRY_MS = 10 * 60 * 1000;
const COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

@singleton()
export class EmailVerificationCodeService {
  constructor(
    private readonly emailVerificationCodeRepository: EmailVerificationCodeRepository,
    private readonly auth0Service: Auth0Service,
    private readonly notificationService: NotificationService,
    private readonly userRepository: UserRepository,
    private readonly logger: LoggerService
  ) {}

  async sendCode(userInternalId: string): Promise<{ codeSentAt: string }> {
    const user = await this.userRepository.findById(userInternalId);
    assert(user, 404, "User not found");
    assert(user.email, 400, "User has no email address");

    const existing = await this.emailVerificationCodeRepository.findByUserId(userInternalId);
    if (existing) {
      const isWithinCooldown = new Date(existing.expiresAt).getTime() > Date.now() + CODE_EXPIRY_MS - COOLDOWN_MS;
      assert(!isWithinCooldown, 429, "Too many verification code requests. Please try again later.");
    }

    const code = randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MS);

    const record = await this.emailVerificationCodeRepository.upsert({
      userId: userInternalId,
      email: user.email,
      code: hashCode(code),
      expiresAt
    });

    await this.notificationService.createNotification(emailVerificationCodeNotification({ id: userInternalId, email: user.email }, { code }));

    this.logger.info({ event: "VERIFICATION_CODE_SENT", userId: userInternalId });

    return { codeSentAt: record.createdAt };
  }

  async verifyCode(userInternalId: string, code: string): Promise<void> {
    const auth0UserId = await this.verifyCodeInTransaction(userInternalId, code);

    try {
      await this.auth0Service.markEmailVerified(auth0UserId);
    } catch (error) {
      this.logger.error({ event: "EMAIL_VERIFIED_MARK_AUTH0_FAILED", userId: userInternalId, auth0UserId, error });
      throw error;
    }

    this.logger.info({ event: "EMAIL_VERIFIED_VIA_CODE", userId: userInternalId });
  }

  @WithTransaction()
  private async verifyCodeInTransaction(userInternalId: string, code: string): Promise<string> {
    const [user, record] = await Promise.all([
      this.userRepository.findById(userInternalId),
      this.emailVerificationCodeRepository.findByUserIdForUpdate(userInternalId)
    ]);
    assert(user, 404, "User not found");
    assert(user.userId, 400, "User has no Auth0 ID");
    assert(record, 400, "No active verification code. Please request a new one.");
    assert(new Date(record.expiresAt) > new Date(), 400, "Verification code expired. Please request a new one.");
    assert(record.attempts < MAX_ATTEMPTS, 429, "Too many attempts. Please request a new code.");

    if (record.code !== hashCode(code)) {
      await this.emailVerificationCodeRepository.incrementAttempts(record.id);
      assert(false, 400, "Invalid verification code");
    }

    await this.userRepository.updateById(userInternalId, { emailVerified: true });

    return user.userId;
  }
}
