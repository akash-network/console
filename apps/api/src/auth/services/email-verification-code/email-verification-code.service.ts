import { randomInt, timingSafeEqual } from "crypto";
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
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;

@singleton()
export class EmailVerificationCodeService {
  constructor(
    private readonly emailVerificationCodeRepository: EmailVerificationCodeRepository,
    private readonly auth0Service: Auth0Service,
    private readonly notificationService: NotificationService,
    private readonly userRepository: UserRepository,
    private readonly logger: LoggerService
  ) {}

  @WithTransaction()
  async sendCode(userInternalId: string): Promise<{ codeSentAt: string }> {
    const user = await this.userRepository.findById(userInternalId);
    assert(user, 404, "User not found");
    assert(user.email, 400, "User has no email address");

    await this.emailVerificationCodeRepository.acquireUserLock(userInternalId);

    const existing = await this.emailVerificationCodeRepository.findActiveByUserId(userInternalId);

    if (existing) {
      const createdAt = new Date(existing.createdAt).getTime();
      const cooldownEnd = createdAt + RESEND_COOLDOWN_MS;

      if (Date.now() < cooldownEnd) {
        return { codeSentAt: existing.createdAt };
      }
    }

    await this.emailVerificationCodeRepository.deleteByUserId(userInternalId);

    const code = randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MS);

    const record = await this.emailVerificationCodeRepository.create({
      userId: userInternalId,
      email: user.email,
      code,
      expiresAt
    });

    await this.notificationService.createNotification(emailVerificationCodeNotification({ id: userInternalId, email: user.email }, { code }));

    this.logger.info({ event: "VERIFICATION_CODE_SENT", userId: userInternalId });

    return { codeSentAt: record.createdAt };
  }

  @WithTransaction()
  async verifyCode(userInternalId: string, code: string): Promise<{ emailVerified: boolean }> {
    const user = await this.userRepository.findById(userInternalId);
    assert(user, 404, "User not found");
    assert(user.userId, 400, "User has no Auth0 ID");

    await this.emailVerificationCodeRepository.acquireUserLock(userInternalId);

    const record = await this.emailVerificationCodeRepository.findActiveByUserId(userInternalId);
    assert(record, 400, "No active verification code. Please request a new one.");
    assert(record.attempts < MAX_ATTEMPTS, 429, "Too many attempts. Please request a new code.");

    const codeBuffer = Buffer.from(code);
    const recordBuffer = Buffer.from(record.code);
    const isCodeValid = codeBuffer.length === recordBuffer.length && timingSafeEqual(recordBuffer, codeBuffer);

    if (!isCodeValid) {
      await this.emailVerificationCodeRepository.incrementAttempts(record.id);
      assert(false, 400, "Invalid verification code");
    }

    await this.auth0Service.markEmailVerified(user.userId);
    await this.userRepository.updateById(userInternalId, { emailVerified: true });
    await this.emailVerificationCodeRepository.deleteByUserId(userInternalId);

    this.logger.info({ event: "EMAIL_VERIFIED_VIA_CODE", userId: userInternalId });

    return { emailVerified: true };
  }
}
