import { faker } from "@faker-js/faker";
import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core/providers/logging.provider";
import { ABUSE_LOCK_REASON, BLOCKED_DOMAIN_LOCK_REASON } from "@src/workload-abuse/lib/abuse-lock-reason/abuse-lock-reason";
import type { DeletedAccountAbuseLockRepository } from "@src/workload-abuse/repositories/deleted-account-abuse-lock/deleted-account-abuse-lock.repository";
import type { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import { DeletedAccountAbuseLockService } from "./deleted-account-abuse-lock.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createUser } from "@test/seeders/user.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

const SECRET = "a".repeat(32);

describe(DeletedAccountAbuseLockService.name, () => {
  describe("rememberLockOf", () => {
    it("keeps keyed hashes of the identity and the normalized email of an account locked for workload abuse", async () => {
      const { service, repository } = setup();
      const account = createUser({ userId: "auth0|abc123", email: "  Jane.Doe@Example.COM " });

      await service.rememberLockOf(account, lockedWallet(ABUSE_LOCK_REASON));

      expect(repository.create).toHaveBeenCalledWith({
        identityHash: keyedHash("deleted-account-identity:auth0|abc123"),
        emailHash: keyedHash("deleted-account-email:jane.doe@example.com"),
        reason: ABUSE_LOCK_REASON
      });
    });

    it("keeps neither the identity nor the email in plain text", async () => {
      const { service, repository } = setup();
      const account = createUser();

      await service.rememberLockOf(account, lockedWallet(ABUSE_LOCK_REASON));

      const stored = JSON.stringify(repository.create.mock.calls[0][0]).toLowerCase();
      expect(stored).not.toContain(account.userId!.toLowerCase());
      expect(stored).not.toContain(account.email!.toLowerCase());
      expect(stored).not.toContain(account.id.toLowerCase());
    });

    it("keeps the email hash alone for an account without an identity", async () => {
      const { service, repository } = setup();

      await service.rememberLockOf(createUser({ userId: null, email: "jane@example.com" }), lockedWallet(ABUSE_LOCK_REASON));

      expect(repository.create).toHaveBeenCalledWith({
        identityHash: null,
        emailHash: keyedHash("deleted-account-email:jane@example.com"),
        reason: ABUSE_LOCK_REASON
      });
    });

    it("keeps the identity hash alone for an account without a usable email", async () => {
      const { service, repository } = setup();

      await service.rememberLockOf(createUser({ userId: "auth0|abc123", email: "not-an-address" }), lockedWallet(ABUSE_LOCK_REASON));

      expect(repository.create).toHaveBeenCalledWith({
        identityHash: keyedHash("deleted-account-identity:auth0|abc123"),
        emailHash: null,
        reason: ABUSE_LOCK_REASON
      });
    });

    it("keeps nothing for an account with neither an identity nor an email", async () => {
      const { service, repository } = setup();

      await service.rememberLockOf(createUser({ userId: null, email: null }), lockedWallet(ABUSE_LOCK_REASON));

      expect(repository.create).not.toHaveBeenCalled();
    });

    it("logs the remembered lock under the deleted account's id", async () => {
      const { service, logger } = setup();
      const account = createUser();

      await service.rememberLockOf(account, lockedWallet(ABUSE_LOCK_REASON));

      expect(logger.info).toHaveBeenCalledWith({ event: "DELETED_ACCOUNT_ABUSE_LOCK_REMEMBERED", userId: account.id, reason: ABUSE_LOCK_REASON });
    });

    it.each([
      ["an unlocked wallet", createUserWallet({ abuseLockedAt: null, abuseLockedReason: null })],
      ["a wallet locked for its email domain", lockedWallet(BLOCKED_DOMAIN_LOCK_REASON)],
      ["no wallet", undefined]
    ])("keeps nothing for an account with %s, even without a secret", async (_, wallet) => {
      const { service, repository } = setup({ secret: undefined });

      await service.rememberLockOf(createUser(), wallet);

      expect(repository.create).not.toHaveBeenCalled();
    });

    it("refuses to forget a locked account when the secret is not configured", async () => {
      const { service, repository } = setup({ secret: undefined });

      await expect(service.rememberLockOf(createUser(), lockedWallet(ABUSE_LOCK_REASON))).rejects.toMatchObject({
        status: 503,
        message: "The account hash secret is not configured"
      });
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe("findLockReasonOf", () => {
    it("looks the account up by the same keyed hashes it was remembered under", async () => {
      const { service, repository } = setup();

      await service.findLockReasonOf(createUser({ userId: "auth0|abc123", email: "JANE.doe@example.com" }));

      expect(repository.findByAnyHash).toHaveBeenCalledWith({
        identityHash: keyedHash("deleted-account-identity:auth0|abc123"),
        emailHash: keyedHash("deleted-account-email:jane.doe@example.com")
      });
    });

    it("returns the reason of a remembered lock and logs the match", async () => {
      const { service, repository, logger } = setup();
      const account = createUser();
      repository.findByAnyHash.mockResolvedValue({
        id: faker.string.uuid(),
        identityHash: null,
        emailHash: null,
        reason: ABUSE_LOCK_REASON,
        createdAt: new Date()
      });

      await expect(service.findLockReasonOf(account)).resolves.toBe(ABUSE_LOCK_REASON);
      expect(logger.info).toHaveBeenCalledWith({ event: "DELETED_ACCOUNT_ABUSE_LOCK_MATCHED", userId: account.id, reason: ABUSE_LOCK_REASON });
    });

    it("returns nothing for an account no lock was remembered for", async () => {
      const { service, repository, logger } = setup();
      repository.findByAnyHash.mockResolvedValue(undefined);

      await expect(service.findLockReasonOf(createUser())).resolves.toBeUndefined();
      expect(logger.info).not.toHaveBeenCalled();
    });

    it("refuses to answer when the secret is not configured", async () => {
      const { service, repository } = setup({ secret: undefined });

      await expect(service.findLockReasonOf(createUser())).rejects.toMatchObject({ status: 503 });
      expect(repository.findByAnyHash).not.toHaveBeenCalled();
    });
  });

  it("creates the logger with the service context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: DeletedAccountAbuseLockService.name });
  });

  function lockedWallet(reason: string) {
    return createUserWallet({ abuseLockedAt: new Date(), abuseLockedReason: reason });
  }

  function keyedHash(value: string) {
    return createHmac("sha256", SECRET).update(value).digest("hex");
  }

  function setup(input: { secret?: string } = { secret: SECRET }) {
    const repository = mock<DeletedAccountAbuseLockRepository>();
    const config = mockConfigService<WorkloadAbuseConfigService>({ WORKLOAD_ABUSE_ACCOUNT_HASH_SECRET: input.secret });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const service = new DeletedAccountAbuseLockService(repository, config, createLogger);

    return { service, repository, logger, createLogger };
  }
});
