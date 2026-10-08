import type { CreateLogger } from "@akashnetwork/logging";
import { PostgresError } from "postgres";
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

      await expect(service.approve({ email: "nobody@example.com", actor: "ops@akash.network" })).rejects.toMatchObject({
        status: 404,
        message: "No user with this email was found",
        errorCode: "affiliate_user_not_found"
      });
    });

    it("rejects with 409 when several users share the email", async () => {
      const { service, userRepository } = setup();
      userRepository.find.mockResolvedValue([createUser(), createUser()]);

      await expect(service.approve({ email: "shared@example.com", actor: "ops@akash.network" })).rejects.toMatchObject({
        status: 409,
        message: "Several users share this email; approve by userId instead",
        errorCode: "affiliate_email_ambiguous"
      });
    });

    it("rejects with 400 when neither a userId nor an email is given", async () => {
      const { service } = setup();

      await expect(service.approve({ actor: "ops@akash.network" })).rejects.toMatchObject({
        status: 400,
        message: "Provide a userId or an email",
        errorCode: "affiliate_user_required"
      });
    });

    it("rejects with 404 when the given userId does not exist", async () => {
      const { service, userRepository, affiliateRepository } = setup();
      userRepository.findById.mockResolvedValue(undefined);

      await expect(service.approve({ userId: "missing-user-id", actor: "ops@akash.network" })).rejects.toMatchObject({
        status: 404,
        message: "No user with this id was found",
        errorCode: "affiliate_user_not_found"
      });
      expect(affiliateRepository.findByUserId).not.toHaveBeenCalled();
    });

    it("trims and lowercases a custom code before storing it", async () => {
      const { service, affiliateRepository, created } = setup();

      await service.approve({ userId: created.userId, code: "  Creator-1 ", actor: "ops@akash.network" });

      expect(affiliateRepository.create).toHaveBeenCalledWith(expect.objectContaining({ code: "creator-1" }));
    });

    it.each(["a", "-ab", "has space"])("rejects with 400 for the invalid code %j", async invalidCode => {
      const { service, affiliateRepository, created } = setup();

      await expect(service.approve({ userId: created.userId, code: invalidCode, actor: "ops@akash.network" })).rejects.toMatchObject({
        status: 400,
        message: "Invalid affiliate code",
        errorCode: "affiliate_code_invalid"
      });
      expect(affiliateRepository.create).not.toHaveBeenCalled();
    });

    it("rejects with 409 when the given code is already used by another affiliate", async () => {
      const { service, affiliateRepository, created } = setup();
      affiliateRepository.findByCode.mockResolvedValue(createAffiliate({ id: "another-affiliate-id" }));

      await expect(service.approve({ userId: created.userId, code: "taken", actor: "ops@akash.network" })).rejects.toMatchObject({
        status: 409,
        message: "This code is already used by another affiliate",
        errorCode: "affiliate_code_taken"
      });
      expect(affiliateRepository.create).not.toHaveBeenCalled();
    });

    it("retries generating a code when the first candidate collides", async () => {
      const { service, affiliateRepository, created } = setup();
      affiliateRepository.findByCode.mockResolvedValueOnce(createAffiliate({ id: "another-affiliate-id" })).mockResolvedValueOnce(undefined);

      await service.approve({ userId: created.userId, actor: "ops@akash.network" });

      expect(affiliateRepository.findByCode).toHaveBeenCalledTimes(2);
      expect(affiliateRepository.create).toHaveBeenCalledTimes(1);
    });

    it("gives up generating a unique code after exhausting its attempts", async () => {
      const { service, affiliateRepository, created } = setup();
      affiliateRepository.findByCode.mockResolvedValue(createAffiliate({ id: "another-affiliate-id" }));

      await expect(service.approve({ userId: created.userId, actor: "ops@akash.network" })).rejects.toMatchObject({
        status: 500,
        errorCode: "affiliate_code_generation_failed"
      });
      expect(affiliateRepository.findByCode).toHaveBeenCalledTimes(5);
      expect(affiliateRepository.create).not.toHaveBeenCalled();
    });

    it("converts a concurrent user_id conflict on create into a 409, for a given code", async () => {
      const { service, affiliateRepository, created } = setup();
      affiliateRepository.create.mockRejectedValue(createUniqueViolation("affiliates_user_id_unique"));

      await expect(service.approve({ userId: created.userId, code: "taken-later", actor: "ops@akash.network" })).rejects.toMatchObject({
        status: 409,
        message: "This user is already an approved affiliate",
        errorCode: "affiliate_already_approved"
      });
    });

    it("converts a concurrent code conflict on create into a 409, for a given code", async () => {
      const { service, affiliateRepository, created } = setup();
      affiliateRepository.create.mockRejectedValue(createUniqueViolation("affiliates_code_unique"));

      await expect(service.approve({ userId: created.userId, code: "raced-code", actor: "ops@akash.network" })).rejects.toMatchObject({
        status: 409,
        message: "This code is already used by another affiliate",
        errorCode: "affiliate_code_taken"
      });
    });

    it("converts a concurrent user_id conflict while generating a code into a 409 without retrying", async () => {
      const { service, affiliateRepository, created } = setup();
      affiliateRepository.create.mockRejectedValue(createUniqueViolation("affiliates_user_id_unique"));

      await expect(service.approve({ userId: created.userId, actor: "ops@akash.network" })).rejects.toMatchObject({
        status: 409,
        message: "This user is already an approved affiliate",
        errorCode: "affiliate_already_approved"
      });
      expect(affiliateRepository.create).toHaveBeenCalledTimes(1);
    });

    it("retries generating a code when the write races another insert of the same candidate", async () => {
      const { service, affiliateRepository, created } = setup();
      affiliateRepository.create.mockRejectedValueOnce(createUniqueViolation("affiliates_code_unique")).mockResolvedValueOnce(created);

      const result = await service.approve({ userId: created.userId, actor: "ops@akash.network" });

      expect(result).toEqual(created);
      expect(affiliateRepository.create).toHaveBeenCalledTimes(2);
    });

    it("rethrows a create failure that is not a unique violation", async () => {
      const { service, affiliateRepository, created } = setup();
      const error = new Error("connection reset");
      affiliateRepository.create.mockRejectedValue(error);

      await expect(service.approve({ userId: created.userId, code: "some-code", actor: "ops@akash.network" })).rejects.toBe(error);
    });

    it("rejects with 409 when the user already has an active affiliate", async () => {
      const { service, affiliateRepository, created } = setup();
      affiliateRepository.findByUserId.mockResolvedValue(createAffiliate({ userId: created.userId, revokedAt: null }));

      await expect(service.approve({ userId: created.userId, actor: "ops@akash.network" })).rejects.toMatchObject({
        status: 409,
        message: "This user is already an approved affiliate",
        errorCode: "affiliate_already_approved"
      });
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

    it("re-approves with the same code already assigned to the affiliate", async () => {
      const { service, affiliateRepository, created } = setup();
      const existing = createAffiliate({ userId: created.userId, code: "same-code", revokedAt: new Date().toISOString(), revokedBy: "ops@akash.network" });
      affiliateRepository.findByUserId.mockResolvedValue(existing);
      affiliateRepository.findByCode.mockResolvedValue(existing);

      await service.approve({ userId: created.userId, code: "same-code", actor: "new-ops@akash.network" });

      expect(affiliateRepository.updateById).toHaveBeenCalledWith(existing.id, expect.objectContaining({ code: "same-code" }), { returning: true });
    });

    it("converts a concurrent code conflict on re-approval into a 409", async () => {
      const { service, affiliateRepository, created } = setup();
      const existing = createAffiliate({ userId: created.userId, code: "old-code", revokedAt: new Date().toISOString(), revokedBy: "ops@akash.network" });
      affiliateRepository.findByUserId.mockResolvedValue(existing);
      affiliateRepository.updateById.mockRejectedValue(createUniqueViolation("affiliates_code_unique"));

      await expect(service.approve({ userId: created.userId, code: "new-code", actor: "ops@akash.network" })).rejects.toMatchObject({
        status: 409,
        message: "This code is already used by another affiliate",
        errorCode: "affiliate_code_taken"
      });
    });
  });

  describe("revoke", () => {
    it("rejects with 404 for an unknown code", async () => {
      const { service, affiliateRepository } = setup();
      affiliateRepository.findByCode.mockResolvedValue(undefined);

      await expect(service.revoke({ code: "unknown", actor: "ops@akash.network" })).rejects.toMatchObject({
        status: 404,
        message: "No affiliate with this code was found",
        errorCode: "affiliate_not_found"
      });
    });

    it("rejects with 404 for a malformed code without reaching the repository", async () => {
      const { service, affiliateRepository } = setup();

      await expect(service.revoke({ code: "a", actor: "ops@akash.network" })).rejects.toMatchObject({
        status: 404,
        message: "No affiliate with this code was found",
        errorCode: "affiliate_not_found"
      });
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

  it("creates the logger with the service context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: AffiliateService.name });
  });

  function setup() {
    const created = createAffiliate();
    const affiliateRepository = mock<AffiliateRepository>();
    affiliateRepository.findByUserId.mockResolvedValue(undefined);
    affiliateRepository.findByCode.mockResolvedValue(undefined);
    affiliateRepository.create.mockResolvedValue(created);
    affiliateRepository.updateById.mockResolvedValue(created as never);
    const userRepository = mock<UserRepository>();
    userRepository.findById.mockImplementation(async id => createUser({ id }));
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new AffiliateService(affiliateRepository, userRepository, createLogger);

    return { service, affiliateRepository, userRepository, logger, createLogger, created };
  }

  function createUniqueViolation(constraintName: string) {
    const driverError = Object.assign(Object.create(PostgresError.prototype), {
      name: "PostgresError",
      code: "23505",
      constraint_name: constraintName,
      message: `duplicate key value violates unique constraint "${constraintName}"`
    });

    return new Error("Failed query: insert into affiliates", { cause: driverError });
  }
});
