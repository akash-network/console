import type { CreateLogger } from "@akashnetwork/logging";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AffiliateRepository } from "@src/affiliate/repositories/affiliate/affiliate.repository";
import type { UserRepository } from "@src/user/repositories";
import { AffiliateService } from "./affiliate.service";

import { createAffiliate } from "@test/seeders/affiliate.seeder";
import { createUser } from "@test/seeders/user.seeder";

describe(AffiliateService.name, () => {
  describe("approve", () => {
    it("creates a row with a generated code when approving a new affiliate by userId", async () => {
      const { service, affiliateRepository, created } = setup();
      const userId = created.userId;

      const result = await service.approve({ userId, actor: "ops@akash.network" });

      expect(affiliateRepository.create).toHaveBeenCalledWith({
        userId,
        code: expect.stringMatching(/^[a-z0-9]{8}$/),
        approvedAt: expect.any(Date),
        approvedBy: "ops@akash.network"
      });
      expect(result).toEqual(created);
    });

    it("logs AFFILIATE_APPROVED with the actor, user and code", async () => {
      const { service, logger, created } = setup();

      await service.approve({ userId: created.userId, actor: "ops@akash.network" });

      expect(logger.info).toHaveBeenCalledWith({
        event: "AFFILIATE_APPROVED",
        actor: "ops@akash.network",
        userId: created.userId,
        code: created.code
      });
    });

    it("resolves the user by email when it matches exactly one user", async () => {
      const { service, affiliateRepository, userRepository } = setup();
      const user = createUser();
      userRepository.find.mockResolvedValue([user]);

      await service.approve({ email: user.email!, actor: "ops@akash.network" });

      expect(affiliateRepository.findByUserId).toHaveBeenCalledWith(user.id);
    });

    it("rejects with 404 when no user matches the email", async () => {
      const { service, userRepository } = setup();
      userRepository.find.mockResolvedValue([]);

      await expect(service.approve({ email: "nobody@example.com", actor: "ops@akash.network" })).rejects.toMatchObject({ status: 404 });
    });

    it("rejects with 409 when several users share the email", async () => {
      const { service, userRepository } = setup();
      userRepository.find.mockResolvedValue([createUser(), createUser()]);

      await expect(service.approve({ email: "shared@example.com", actor: "ops@akash.network" })).rejects.toMatchObject({ status: 409 });
    });

    it("rejects with 400 when neither a userId nor an email is given", async () => {
      const { service } = setup();

      await expect(service.approve({ actor: "ops@akash.network" })).rejects.toMatchObject({ status: 400 });
    });

    it("trims and lowercases a custom code before storing it", async () => {
      const { service, affiliateRepository, created } = setup();

      await service.approve({ userId: created.userId, code: "  Creator-1 ", actor: "ops@akash.network" });

      expect(affiliateRepository.create).toHaveBeenCalledWith(expect.objectContaining({ code: "creator-1" }));
    });

    it.each(["a", "-ab", "has space"])("rejects with 400 for the invalid code %j", async invalidCode => {
      const { service, affiliateRepository, created } = setup();

      await expect(service.approve({ userId: created.userId, code: invalidCode, actor: "ops@akash.network" })).rejects.toMatchObject({ status: 400 });
      expect(affiliateRepository.create).not.toHaveBeenCalled();
    });

    it("rejects with 409 when the given code is already used by another affiliate", async () => {
      const { service, affiliateRepository, created } = setup();
      affiliateRepository.findByCode.mockResolvedValue(createAffiliate({ id: "another-affiliate-id" }));

      await expect(service.approve({ userId: created.userId, code: "taken", actor: "ops@akash.network" })).rejects.toMatchObject({ status: 409 });
      expect(affiliateRepository.create).not.toHaveBeenCalled();
    });

    it("retries generating a code when the first candidate collides", async () => {
      const { service, affiliateRepository, created } = setup();
      affiliateRepository.findByCode.mockResolvedValueOnce(createAffiliate({ id: "another-affiliate-id" })).mockResolvedValueOnce(undefined);

      await service.approve({ userId: created.userId, actor: "ops@akash.network" });

      expect(affiliateRepository.findByCode).toHaveBeenCalledTimes(2);
      expect(affiliateRepository.create).toHaveBeenCalledTimes(1);
    });

    it("rejects with 409 when the user already has an active affiliate", async () => {
      const { service, affiliateRepository, created } = setup();
      affiliateRepository.findByUserId.mockResolvedValue(createAffiliate({ userId: created.userId, revokedAt: null }));

      await expect(service.approve({ userId: created.userId, actor: "ops@akash.network" })).rejects.toMatchObject({ status: 409 });
      expect(affiliateRepository.create).not.toHaveBeenCalled();
    });

    it("re-approves a revoked affiliate, clearing the revoked fields and keeping the existing code", async () => {
      const { service, affiliateRepository, created } = setup();
      const existing = createAffiliate({ userId: created.userId, code: "old-code", revokedAt: new Date().toISOString(), revokedBy: "ops@akash.network" });
      affiliateRepository.findByUserId.mockResolvedValue(existing);

      await service.approve({ userId: created.userId, actor: "new-ops@akash.network" });

      expect(affiliateRepository.updateById).toHaveBeenCalledWith(
        existing.id,
        { code: "old-code", approvedAt: expect.any(Date), approvedBy: "new-ops@akash.network", revokedAt: null, revokedBy: null },
        { returning: true }
      );
    });

    it("replaces the code of a re-approved affiliate only when a new code is given", async () => {
      const { service, affiliateRepository, created } = setup();
      const existing = createAffiliate({ userId: created.userId, code: "old-code", revokedAt: new Date().toISOString(), revokedBy: "ops@akash.network" });
      affiliateRepository.findByUserId.mockResolvedValue(existing);

      await service.approve({ userId: created.userId, code: "new-code", actor: "new-ops@akash.network" });

      expect(affiliateRepository.updateById).toHaveBeenCalledWith(existing.id, expect.objectContaining({ code: "new-code" }), { returning: true });
    });
  });

  describe("revoke", () => {
    it("rejects with 404 for an unknown code", async () => {
      const { service, affiliateRepository } = setup();
      affiliateRepository.findByCode.mockResolvedValue(undefined);

      await expect(service.revoke({ code: "unknown", actor: "ops@akash.network" })).rejects.toMatchObject({ status: 404 });
    });

    it("rejects with 404 for a malformed code without reaching the repository", async () => {
      const { service, affiliateRepository } = setup();

      await expect(service.revoke({ code: "a", actor: "ops@akash.network" })).rejects.toMatchObject({ status: 404 });
      expect(affiliateRepository.findByCode).not.toHaveBeenCalled();
    });

    it("sets revokedAt and revokedBy on an active affiliate", async () => {
      const { service, affiliateRepository } = setup();
      const active = createAffiliate({ revokedAt: null });
      affiliateRepository.findByCode.mockResolvedValue(active);

      await service.revoke({ code: active.code, actor: "ops@akash.network" });

      expect(affiliateRepository.updateById).toHaveBeenCalledWith(
        active.id,
        { revokedAt: expect.any(Date), revokedBy: "ops@akash.network" },
        { returning: true }
      );
    });

    it("logs AFFILIATE_REVOKED when revoking an active affiliate", async () => {
      const { service, affiliateRepository, logger } = setup();
      const active = createAffiliate({ revokedAt: null });
      affiliateRepository.findByCode.mockResolvedValue(active);
      const revoked = createAffiliate({ ...active, revokedAt: new Date().toISOString(), revokedBy: "ops@akash.network" });
      affiliateRepository.updateById.mockResolvedValue(revoked as never);

      await service.revoke({ code: active.code, actor: "ops@akash.network" });

      expect(logger.info).toHaveBeenCalledWith({ event: "AFFILIATE_REVOKED", actor: "ops@akash.network", userId: active.userId, code: active.code });
    });

    it("returns an already-revoked affiliate unchanged without updating or logging again", async () => {
      const { service, affiliateRepository, logger } = setup();
      const revoked = createAffiliate({ revokedAt: new Date().toISOString(), revokedBy: "ops@akash.network" });
      affiliateRepository.findByCode.mockResolvedValue(revoked);

      const result = await service.revoke({ code: revoked.code, actor: "someone-else@akash.network" });

      expect(result).toEqual(revoked);
      expect(affiliateRepository.updateById).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
    });
  });

  describe("findActiveByCode", () => {
    it("normalizes the code before looking up an active affiliate", async () => {
      const { service, affiliateRepository } = setup();
      const active = createAffiliate({ revokedAt: null });
      affiliateRepository.findByCode.mockResolvedValue(active);

      const result = await service.findActiveByCode("MyCode ");

      expect(affiliateRepository.findByCode).toHaveBeenCalledWith("mycode");
      expect(result).toEqual(active);
    });

    it("returns undefined for a revoked affiliate", async () => {
      const { service, affiliateRepository } = setup();
      affiliateRepository.findByCode.mockResolvedValue(createAffiliate({ revokedAt: new Date().toISOString() }));

      await expect(service.findActiveByCode("code")).resolves.toBeUndefined();
    });

    it("returns undefined for a malformed code without reaching the repository", async () => {
      const { service, affiliateRepository } = setup();

      await expect(service.findActiveByCode("a")).resolves.toBeUndefined();
      expect(affiliateRepository.findByCode).not.toHaveBeenCalled();
    });
  });

  describe("findActiveByUserId", () => {
    it("returns an active affiliate for the user", async () => {
      const { service, affiliateRepository } = setup();
      const active = createAffiliate({ revokedAt: null });
      affiliateRepository.findByUserId.mockResolvedValue(active);

      await expect(service.findActiveByUserId(active.userId)).resolves.toEqual(active);
    });

    it("returns undefined when the user's affiliate was revoked", async () => {
      const { service, affiliateRepository } = setup();
      affiliateRepository.findByUserId.mockResolvedValue(createAffiliate({ revokedAt: new Date().toISOString() }));

      await expect(service.findActiveByUserId("some-user-id")).resolves.toBeUndefined();
    });
  });

  function setup() {
    const created = createAffiliate();
    const affiliateRepository = mock<AffiliateRepository>();
    affiliateRepository.findByUserId.mockResolvedValue(undefined);
    affiliateRepository.findByCode.mockResolvedValue(undefined);
    affiliateRepository.create.mockResolvedValue(created);
    affiliateRepository.updateById.mockResolvedValue(created as never);
    const userRepository = mock<UserRepository>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new AffiliateService(affiliateRepository, userRepository, createLogger);

    return { service, affiliateRepository, userRepository, logger, createLogger, created };
  }
});
