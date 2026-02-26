import "@test/mocks/logger-service.mock";

import { faker } from "@faker-js/faker";
import { mock } from "vitest-mock-extended";

import type {
  EmailVerificationCodeOutput,
  EmailVerificationCodeRepository
} from "@src/auth/repositories/email-verification-code/email-verification-code.repository";
import type { Auth0Service } from "@src/auth/services/auth0/auth0.service";
import type { LoggerService } from "@src/core/providers/logging.provider";
import type { NotificationService } from "@src/notifications/services/notification/notification.service";
import type { UserRepository } from "@src/user/repositories/user/user.repository";
import { EmailVerificationCodeService } from "./email-verification-code.service";

import { UserSeeder } from "@test/seeders/user.seeder";

describe(EmailVerificationCodeService.name, () => {
  describe("sendCode", () => {
    it("acquires advisory lock before checking for existing code", async () => {
      const user = UserSeeder.create({ email: "test@example.com" });
      const { service, emailVerificationCodeRepository, userRepository } = setup();
      const callOrder: string[] = [];

      userRepository.findById.mockResolvedValue(user);
      emailVerificationCodeRepository.acquireUserLock.mockImplementation(async () => {
        callOrder.push("acquireUserLock");
      });
      emailVerificationCodeRepository.findActiveByUserId.mockImplementation(async () => {
        callOrder.push("findActiveByUserId");
        return undefined;
      });
      emailVerificationCodeRepository.create.mockResolvedValue(createVerificationCodeOutput({ userId: user.id }));

      await service.sendCode(user.id);

      expect(callOrder).toEqual(["acquireUserLock", "findActiveByUserId"]);
    });

    it("returns existing codeSentAt without resend when active code exists", async () => {
      const user = UserSeeder.create({ email: "test@example.com" });
      const existingCode = createVerificationCodeOutput({
        userId: user.id,
        createdAt: new Date(Date.now() - 10_000).toISOString()
      });
      const { service, emailVerificationCodeRepository, userRepository, notificationService } = setup();

      userRepository.findById.mockResolvedValue(user);
      emailVerificationCodeRepository.findActiveByUserId.mockResolvedValue(existingCode);

      const result = await service.sendCode(user.id);

      expect(result).toEqual({ codeSentAt: existingCode.createdAt });
      expect(emailVerificationCodeRepository.deleteByUserId).not.toHaveBeenCalled();
      expect(emailVerificationCodeRepository.create).not.toHaveBeenCalled();
      expect(notificationService.createNotification).not.toHaveBeenCalled();
    });

    it("returns existing codeSentAt on resend when cooldown is active", async () => {
      const user = UserSeeder.create({ email: "test@example.com" });
      const existingCode = createVerificationCodeOutput({
        userId: user.id,
        createdAt: new Date(Date.now() - 10_000).toISOString()
      });
      const { service, emailVerificationCodeRepository, userRepository, notificationService } = setup();

      userRepository.findById.mockResolvedValue(user);
      emailVerificationCodeRepository.findActiveByUserId.mockResolvedValue(existingCode);

      const result = await service.sendCode(user.id, { resend: true });

      expect(result).toEqual({ codeSentAt: existingCode.createdAt });
      expect(emailVerificationCodeRepository.deleteByUserId).not.toHaveBeenCalled();
      expect(emailVerificationCodeRepository.create).not.toHaveBeenCalled();
      expect(notificationService.createNotification).not.toHaveBeenCalled();
    });

    it("sends new code on resend when cooldown has expired", async () => {
      const user = UserSeeder.create({ email: "test@example.com" });
      const expiredCode = createVerificationCodeOutput({
        userId: user.id,
        createdAt: new Date(Date.now() - 61_000).toISOString()
      });
      const createdRecord = createVerificationCodeOutput({ userId: user.id });
      const { service, emailVerificationCodeRepository, userRepository, notificationService } = setup();

      userRepository.findById.mockResolvedValue(user);
      emailVerificationCodeRepository.findActiveByUserId.mockResolvedValue(expiredCode);
      emailVerificationCodeRepository.create.mockResolvedValue(createdRecord);

      const result = await service.sendCode(user.id, { resend: true });

      expect(emailVerificationCodeRepository.deleteByUserId).toHaveBeenCalledWith(user.id);
      expect(emailVerificationCodeRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: user.id,
          email: user.email,
          code: expect.stringMatching(/^\d{6}$/)
        })
      );
      expect(notificationService.createNotification).toHaveBeenCalled();
      expect(result.codeSentAt).toBe(createdRecord.createdAt);
    });

    it("sends new code when no existing code found", async () => {
      const user = UserSeeder.create({ email: "test@example.com" });
      const createdRecord = createVerificationCodeOutput({ userId: user.id });
      const { service, emailVerificationCodeRepository, userRepository, notificationService } = setup();

      userRepository.findById.mockResolvedValue(user);
      emailVerificationCodeRepository.findActiveByUserId.mockResolvedValue(undefined);
      emailVerificationCodeRepository.create.mockResolvedValue(createdRecord);

      const result = await service.sendCode(user.id);

      expect(emailVerificationCodeRepository.deleteByUserId).toHaveBeenCalledWith(user.id);
      expect(emailVerificationCodeRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: user.id,
          email: user.email,
          code: expect.stringMatching(/^\d{6}$/)
        })
      );
      expect(notificationService.createNotification).toHaveBeenCalled();
      expect(result.codeSentAt).toBe(createdRecord.createdAt);
    });

    it("throws 404 when user not found", async () => {
      const { service, userRepository } = setup();

      userRepository.findById.mockResolvedValue(undefined);

      await expect(service.sendCode("nonexistent")).rejects.toThrow();
    });

    it("throws 400 when user has no email", async () => {
      const user = UserSeeder.create({ email: null });
      const { service, userRepository } = setup();

      userRepository.findById.mockResolvedValue(user);

      await expect(service.sendCode(user.id)).rejects.toThrow();
    });
  });

  describe("verifyCode", () => {
    it("verifies valid code and marks email as verified", async () => {
      const code = "123456";
      const user = UserSeeder.create({ userId: "auth0|123" });
      const record = createVerificationCodeOutput({ userId: user.id, code, attempts: 0 });
      const { service, emailVerificationCodeRepository, userRepository, auth0Service } = setup();

      userRepository.findById.mockResolvedValue(user);
      emailVerificationCodeRepository.findActiveByUserId.mockResolvedValue(record);

      const result = await service.verifyCode(user.id, code);

      expect(result).toEqual({ emailVerified: true });
      expect(auth0Service.markEmailVerified).toHaveBeenCalledWith(user.userId);
      expect(userRepository.updateById).toHaveBeenCalledWith(user.id, { emailVerified: true });
      expect(emailVerificationCodeRepository.deleteByUserId).toHaveBeenCalledWith(user.id);
    });

    it("returns emailVerified false and increments attempts for invalid code", async () => {
      const user = UserSeeder.create({ userId: "auth0|123" });
      const record = createVerificationCodeOutput({ userId: user.id, code: "123456", attempts: 0 });
      const { service, emailVerificationCodeRepository, userRepository } = setup();

      userRepository.findById.mockResolvedValue(user);
      emailVerificationCodeRepository.findActiveByUserId.mockResolvedValue(record);

      const result = await service.verifyCode(user.id, "999999");

      expect(result).toEqual({ emailVerified: false });
      expect(emailVerificationCodeRepository.incrementAttempts).toHaveBeenCalledWith(record.id);
    });

    it("rejects when max attempts exceeded", async () => {
      const user = UserSeeder.create({ userId: "auth0|123" });
      const record = createVerificationCodeOutput({ userId: user.id, code: "123456", attempts: 5 });
      const { service, emailVerificationCodeRepository, userRepository } = setup();

      userRepository.findById.mockResolvedValue(user);
      emailVerificationCodeRepository.findActiveByUserId.mockResolvedValue(record);

      await expect(service.verifyCode(user.id, "123456")).rejects.toThrow();
      expect(emailVerificationCodeRepository.incrementAttempts).not.toHaveBeenCalled();
    });

    it("returns emailVerified false for mismatched length code", async () => {
      const user = UserSeeder.create({ userId: "auth0|123" });
      const record = createVerificationCodeOutput({ userId: user.id, code: "123456", attempts: 0 });
      const { service, emailVerificationCodeRepository, userRepository } = setup();

      userRepository.findById.mockResolvedValue(user);
      emailVerificationCodeRepository.findActiveByUserId.mockResolvedValue(record);

      const result = await service.verifyCode(user.id, "12345");

      expect(result).toEqual({ emailVerified: false });
      expect(emailVerificationCodeRepository.incrementAttempts).toHaveBeenCalledWith(record.id);
    });

    it("rejects when no active code exists", async () => {
      const user = UserSeeder.create({ userId: "auth0|123" });
      const { service, emailVerificationCodeRepository, userRepository } = setup();

      userRepository.findById.mockResolvedValue(user);
      emailVerificationCodeRepository.findActiveByUserId.mockResolvedValue(undefined);

      await expect(service.verifyCode(user.id, "123456")).rejects.toThrow();
    });
  });

  function createVerificationCodeOutput(overrides: Partial<EmailVerificationCodeOutput> = {}): EmailVerificationCodeOutput {
    return {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      email: faker.internet.email(),
      code: faker.string.numeric(6),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      attempts: 0,
      createdAt: new Date().toISOString(),
      ...overrides
    };
  }

  function setup(
    input: {
      emailVerificationCodeRepository?: EmailVerificationCodeRepository;
      auth0Service?: Auth0Service;
      notificationService?: NotificationService;
      userRepository?: UserRepository;
      logger?: LoggerService;
    } = {}
  ) {
    const emailVerificationCodeRepository = input.emailVerificationCodeRepository ?? mock<EmailVerificationCodeRepository>();
    const auth0Service = input.auth0Service ?? mock<Auth0Service>();
    const notificationService = input.notificationService ?? mock<NotificationService>();
    const userRepository = input.userRepository ?? mock<UserRepository>();
    const logger = input.logger ?? mock<LoggerService>();

    emailVerificationCodeRepository.acquireUserLock.mockResolvedValue(undefined);

    const service = new EmailVerificationCodeService(emailVerificationCodeRepository, auth0Service, notificationService, userRepository, logger);

    return {
      service,
      emailVerificationCodeRepository,
      auth0Service,
      notificationService,
      userRepository,
      logger
    };
  }
});
