import { faker } from "@faker-js/faker";
import { createHash } from "crypto";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type {
  EmailVerificationCodeOutput,
  EmailVerificationCodeRepository
} from "@src/auth/repositories/email-verification-code/email-verification-code.repository";
import type { Auth0Service } from "@src/auth/services/auth0/auth0.service";
import { EmailVerificationCodeService } from "@src/auth/services/email-verification-code/email-verification-code.service";
import type { TrialActivationJobService } from "@src/billing/services/trial-activation-job/trial-activation-job.service";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { NotificationService } from "@src/notifications/services/notification/notification.service";
import type { UserRepository } from "@src/user/repositories/user/user.repository";

import { createUser } from "@test/seeders/user.seeder";

describe(EmailVerificationCodeService.name, () => {
  describe("sendCode", () => {
    it("creates a new code and sends notification", async () => {
      const user = createUser({ email: "test@example.com" });
      const createdRecord = createVerificationCodeOutput({ userId: user.id });
      const { service, emailVerificationCodeRepository, userRepository, notificationService } = setup();

      userRepository.findById.mockResolvedValue(user);
      emailVerificationCodeRepository.findByUserId.mockResolvedValue(undefined);
      emailVerificationCodeRepository.upsert.mockResolvedValue(createdRecord);

      const result = await service.sendCode(user.id);

      expect(emailVerificationCodeRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: user.id,
          email: user.email,
          code: expect.stringMatching(/^[a-f0-9]{64}$/)
        })
      );
      expect(notificationService.createNotification).toHaveBeenCalled();
      expect(result.codeSentAt).toBe(createdRecord.createdAt);
    });

    it("upserts over an existing code outside cooldown", async () => {
      const user = createUser({ email: "test@example.com" });
      const existingRecord = createVerificationCodeOutput({
        userId: user.id,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
      });
      const newRecord = createVerificationCodeOutput({ userId: user.id });
      const { service, emailVerificationCodeRepository, userRepository } = setup();

      userRepository.findById.mockResolvedValue(user);
      emailVerificationCodeRepository.findByUserId.mockResolvedValue(existingRecord);
      emailVerificationCodeRepository.upsert.mockResolvedValue(newRecord);

      const result = await service.sendCode(user.id);

      expect(emailVerificationCodeRepository.upsert).toHaveBeenCalled();
      expect(result.codeSentAt).toBe(newRecord.createdAt);
    });

    it("throws 429 when within cooldown window", async () => {
      const user = createUser({ email: "test@example.com" });
      const recentRecord = createVerificationCodeOutput({
        userId: user.id,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
      });
      const { service, emailVerificationCodeRepository, userRepository } = setup();

      userRepository.findById.mockResolvedValue(user);
      emailVerificationCodeRepository.findByUserId.mockResolvedValue(recentRecord);

      await expect(service.sendCode(user.id)).rejects.toThrow("Please wait before requesting a new verification code");
    });

    it("throws 404 when user not found", async () => {
      const { service, userRepository } = setup();

      userRepository.findById.mockResolvedValue(undefined);

      await expect(service.sendCode("nonexistent")).rejects.toThrow();
    });

    it("throws 400 when user has no email", async () => {
      const user = createUser({ email: null });
      const { service, userRepository } = setup();

      userRepository.findById.mockResolvedValue(user);

      await expect(service.sendCode(user.id)).rejects.toThrow();
    });

    it("deletes the code record when notification fails", async () => {
      const user = createUser({ email: "test@example.com" });
      const createdRecord = createVerificationCodeOutput({ userId: user.id });
      const { service, emailVerificationCodeRepository, userRepository, notificationService } = setup();

      userRepository.findById.mockResolvedValue(user);
      emailVerificationCodeRepository.findByUserId.mockResolvedValue(undefined);
      emailVerificationCodeRepository.upsert.mockResolvedValue(createdRecord);
      notificationService.createNotification.mockRejectedValue(new Error("Notification service unavailable"));

      await expect(service.sendCode(user.id)).rejects.toThrow("Notification service unavailable");
      expect(emailVerificationCodeRepository.deleteByUserId).toHaveBeenCalledWith(user.id);
    });
  });

  describe("verifyCode", () => {
    it("verifies valid code and marks email as verified", async () => {
      const code = "123456";
      const user = createUser({ userId: "auth0|123" });
      const record = createVerificationCodeOutput({ userId: user.id, code: hashCode(code), attempts: 0 });
      const { service, emailVerificationCodeRepository, userRepository, auth0Service } = setup();

      userRepository.findById.mockResolvedValue(user);
      emailVerificationCodeRepository.findByUserId.mockResolvedValue(record);
      emailVerificationCodeRepository.claimAttempt.mockResolvedValue({ ...record, attempts: 1 });

      await service.verifyCode(user.id, code);

      expect(emailVerificationCodeRepository.claimAttempt).toHaveBeenCalledWith(record.id, 5);
      expect(auth0Service.markEmailVerified).toHaveBeenCalledWith(user.userId);
      expect(userRepository.updateById).toHaveBeenCalledWith(user.id, { emailVerified: true });
    });

    it("counts the attempt and rejects an invalid code", async () => {
      const user = createUser({ userId: "auth0|123" });
      const record = createVerificationCodeOutput({ userId: user.id, code: hashCode("123456"), attempts: 0 });
      const { service, emailVerificationCodeRepository, userRepository } = setup();

      userRepository.findById.mockResolvedValue(user);
      emailVerificationCodeRepository.findByUserId.mockResolvedValue(record);
      emailVerificationCodeRepository.claimAttempt.mockResolvedValue({ ...record, attempts: 1 });

      await expect(service.verifyCode(user.id, "999999")).rejects.toMatchObject({ status: 400, message: "Invalid verification code" });
      expect(emailVerificationCodeRepository.claimAttempt).toHaveBeenCalledWith(record.id, 5);
      expect(userRepository.updateById).not.toHaveBeenCalled();
    });

    it("rejects even a valid code once no attempt is left", async () => {
      const code = "123456";
      const user = createUser({ userId: "auth0|123" });
      const record = createVerificationCodeOutput({ userId: user.id, code: hashCode(code), attempts: 4 });
      const { service, emailVerificationCodeRepository, userRepository } = setup();

      userRepository.findById.mockResolvedValue(user);
      emailVerificationCodeRepository.findByUserId.mockResolvedValue(record);
      emailVerificationCodeRepository.claimAttempt.mockResolvedValue(undefined);

      await expect(service.verifyCode(user.id, code)).rejects.toMatchObject({ status: 429, message: "Too many attempts. Please request a new code." });
      expect(userRepository.updateById).not.toHaveBeenCalled();
    });

    it("compares against the code the claimed attempt returns", async () => {
      const resentCode = "654321";
      const user = createUser({ userId: "auth0|123" });
      const record = createVerificationCodeOutput({ userId: user.id, code: hashCode("123456"), attempts: 0 });
      const { service, emailVerificationCodeRepository, userRepository } = setup();

      userRepository.findById.mockResolvedValue(user);
      emailVerificationCodeRepository.findByUserId.mockResolvedValue(record);
      emailVerificationCodeRepository.claimAttempt.mockResolvedValue({ ...record, code: hashCode(resentCode), attempts: 1 });

      await service.verifyCode(user.id, resentCode);

      expect(userRepository.updateById).toHaveBeenCalledWith(user.id, { emailVerified: true });
    });

    it("rejects when code is expired", async () => {
      const code = "123456";
      const user = createUser({ userId: "auth0|123" });
      const record = createVerificationCodeOutput({
        userId: user.id,
        code: hashCode(code),
        attempts: 0,
        expiresAt: new Date(Date.now() - 1000).toISOString()
      });
      const { service, emailVerificationCodeRepository, userRepository } = setup();

      userRepository.findById.mockResolvedValue(user);
      emailVerificationCodeRepository.findByUserId.mockResolvedValue(record);

      await expect(service.verifyCode(user.id, code)).rejects.toThrow("Verification code expired");
      expect(emailVerificationCodeRepository.claimAttempt).not.toHaveBeenCalled();
    });

    it("updates local DB even if Auth0 call fails", async () => {
      const code = "123456";
      const user = createUser({ userId: "auth0|123" });
      const record = createVerificationCodeOutput({ userId: user.id, code: hashCode(code), attempts: 0 });
      const { service, emailVerificationCodeRepository, userRepository, auth0Service } = setup();

      userRepository.findById.mockResolvedValue(user);
      emailVerificationCodeRepository.findByUserId.mockResolvedValue(record);
      emailVerificationCodeRepository.claimAttempt.mockResolvedValue({ ...record, attempts: 1 });
      auth0Service.markEmailVerified.mockRejectedValue(new Error("Auth0 unavailable"));

      await expect(service.verifyCode(user.id, code)).rejects.toThrow("Auth0 unavailable");

      expect(userRepository.updateById).toHaveBeenCalledWith(user.id, { emailVerified: true });
    });

    it("rejects when no active code exists", async () => {
      const user = createUser({ userId: "auth0|123" });
      const { service, emailVerificationCodeRepository, userRepository } = setup();

      userRepository.findById.mockResolvedValue(user);
      emailVerificationCodeRepository.findByUserId.mockResolvedValue(undefined);

      await expect(service.verifyCode(user.id, "123456")).rejects.toThrow();
    });
  });

  function hashCode(code: string) {
    return createHash("sha256").update(code).digest("hex");
  }

  function createVerificationCodeOutput(overrides: Partial<EmailVerificationCodeOutput> = {}): EmailVerificationCodeOutput {
    return {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      email: faker.internet.email(),
      code: hashCode(faker.string.numeric(6)),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      attempts: 0,
      createdAt: new Date().toISOString(),
      ...overrides
    };
  }

  it("creates the logger with the service context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: EmailVerificationCodeService.name });
  });

  function setup() {
    const emailVerificationCodeRepository = mock<EmailVerificationCodeRepository>();
    const auth0Service = mock<Auth0Service>();
    const notificationService = mock<NotificationService>();
    const userRepository = mock<UserRepository>();
    const trialActivationJobService = mock<TrialActivationJobService>({ schedule: vi.fn().mockResolvedValue(undefined) });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new EmailVerificationCodeService(
      emailVerificationCodeRepository,
      auth0Service,
      notificationService,
      userRepository,
      trialActivationJobService,
      createLogger
    );

    return {
      service,
      emailVerificationCodeRepository,
      auth0Service,
      notificationService,
      userRepository,
      logger,
      createLogger
    };
  }
});
