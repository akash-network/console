import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { cacheRegistry } from "@src/caching/cache-registry";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { BlockedEmailDomainRepository } from "@src/workload-abuse/repositories/blocked-email-domain/blocked-email-domain.repository";
import type { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import { BlockedEmailDomainService } from "./blocked-email-domain.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createBlockedEmailDomain } from "@test/seeders/blocked-email-domain.seeder";

describe(BlockedEmailDomainService.name, () => {
  describe("isBlockedEmail", () => {
    it("blocks an address whose domain has a blocked row", async () => {
      const { service, blockedEmailDomainRepository } = setup({ row: createBlockedEmailDomain({ domain: "attacker.com", status: "blocked" }) });

      await expect(service.isBlockedEmail("miner@attacker.com")).resolves.toBe(true);
      expect(blockedEmailDomainRepository.findByDomain).toHaveBeenCalledWith("attacker.com");
    });

    it("allows an address whose domain an operator has explicitly allowed", async () => {
      const { service } = setup({ row: createBlockedEmailDomain({ domain: "customer.com", status: "allowed" }) });

      await expect(service.isBlockedEmail("someone@customer.com")).resolves.toBe(false);
    });

    it("allows an address whose domain has no row", async () => {
      const { service } = setup();

      await expect(service.isBlockedEmail("someone@unknown.com")).resolves.toBe(false);
    });

    it("looks up the normalized domain of a mixed-case address", async () => {
      const { service, blockedEmailDomainRepository } = setup();

      await service.isBlockedEmail("Miner@Attacker.COM");

      expect(blockedEmailDomainRepository.findByDomain).toHaveBeenCalledWith("attacker.com");
    });

    it("allows an address it cannot parse without consulting the repository", async () => {
      const { service, blockedEmailDomainRepository } = setup();

      await expect(service.isBlockedEmail("not-an-address")).resolves.toBe(false);
      expect(blockedEmailDomainRepository.findByDomain).not.toHaveBeenCalled();
    });

    it("allows every address without consulting the repository while the flag is off", async () => {
      const { service, blockedEmailDomainRepository } = setup({
        isFlagEnabled: false,
        row: createBlockedEmailDomain({ domain: "attacker.com", status: "blocked" })
      });

      await expect(service.isBlockedEmail("miner@attacker.com")).resolves.toBe(false);
      expect(blockedEmailDomainRepository.findByDomain).not.toHaveBeenCalled();
    });

    it("reads the enforcement flag", async () => {
      const { service, featureFlagsService } = setup();

      await service.isBlockedEmail("someone@unknown.com");

      expect(featureFlagsService.isEnabled).toHaveBeenCalledWith(FeatureFlags.BLOCKED_EMAIL_DOMAIN_ENFORCEMENT);
    });

    it("answers a repeated lookup from the cache", async () => {
      const { service, blockedEmailDomainRepository } = setup({ row: createBlockedEmailDomain({ domain: "attacker.com", status: "blocked" }) });

      await service.isBlockedEmail("one@attacker.com");
      await service.isBlockedEmail("two@attacker.com");

      expect(blockedEmailDomainRepository.findByDomain).toHaveBeenCalledTimes(1);
    });

    it("caches a negative so a legitimate domain does not reach the database on every login", async () => {
      const { service, blockedEmailDomainRepository } = setup();

      await service.isBlockedEmail("someone@customer.com");
      await service.isBlockedEmail("someone.else@customer.com");

      expect(blockedEmailDomainRepository.findByDomain).toHaveBeenCalledTimes(1);
    });
  });

  describe("isBlockedDomain", () => {
    it("blocks a bare domain that has a blocked row", async () => {
      const { service } = setup({ row: createBlockedEmailDomain({ domain: "attacker.com", status: "blocked" }) });

      await expect(service.isBlockedDomain("Attacker.com.")).resolves.toBe(true);
    });

    it("allows a domain it cannot normalize", async () => {
      const { service, blockedEmailDomainRepository } = setup();

      await expect(service.isBlockedDomain("localhost")).resolves.toBe(false);
      expect(blockedEmailDomainRepository.findByDomain).not.toHaveBeenCalled();
    });
  });

  describe("when the lookup fails", () => {
    it("allows the address and records the failure", async () => {
      const { service, logger } = setup({ lookupError: new Error("connection terminated") });

      await expect(service.isBlockedEmail("miner@attacker.com")).resolves.toBe(false);
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "BLOCKED_EMAIL_DOMAIN_LOOKUP_FAILED", domain: "attacker.com" }));
    });

    it("retries the next lookup rather than caching the failure", async () => {
      const { service, blockedEmailDomainRepository } = setup({ lookupError: new Error("connection terminated") });

      await service.isBlockedEmail("miner@attacker.com");
      await service.isBlockedEmail("miner@attacker.com");

      expect(blockedEmailDomainRepository.findByDomain).toHaveBeenCalledTimes(2);
    });
  });

  describe("rememberBlocked", () => {
    it("answers a following lookup without reading the row it was just told about", async () => {
      const { service, blockedEmailDomainRepository } = setup();

      service.rememberBlocked("attacker.com");

      await expect(service.isBlockedEmail("miner@attacker.com")).resolves.toBe(true);
      expect(blockedEmailDomainRepository.findByDomain).not.toHaveBeenCalled();
    });
  });

  it("registers itself so a registry-wide clear empties it", async () => {
    const { service, blockedEmailDomainRepository } = setup();
    service.rememberBlocked("attacker.com");

    cacheRegistry.clearAll();
    await service.isBlockedEmail("miner@attacker.com");

    expect(cacheRegistry.getStats().some(stats => stats.name.startsWith(BlockedEmailDomainService.name))).toBe(true);
    expect(blockedEmailDomainRepository.findByDomain).toHaveBeenCalledWith("attacker.com");
  });

  function setup(input?: { row?: ReturnType<typeof createBlockedEmailDomain>; isFlagEnabled?: boolean; lookupError?: Error; ttlSeconds?: number }) {
    const findByDomain = input?.lookupError ? vi.fn().mockRejectedValue(input.lookupError) : vi.fn().mockResolvedValue(input?.row);
    const blockedEmailDomainRepository = mock<BlockedEmailDomainRepository>({ findByDomain });
    const featureFlagsService = mock<FeatureFlagsService>({ isEnabled: vi.fn().mockReturnValue(input?.isFlagEnabled ?? true) });
    const workloadAbuseConfigService = mockConfigService<WorkloadAbuseConfigService>({
      WORKLOAD_ABUSE_BLOCKED_DOMAIN_CACHE_TTL_SECONDS: input?.ttlSeconds ?? 60
    });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new BlockedEmailDomainService(blockedEmailDomainRepository, featureFlagsService, workloadAbuseConfigService, createLogger);

    return { service, blockedEmailDomainRepository, featureFlagsService, workloadAbuseConfigService, logger, createLogger };
  }
});
