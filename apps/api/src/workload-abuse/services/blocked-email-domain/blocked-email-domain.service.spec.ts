import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { cacheRegistry } from "@src/caching/cache-registry";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { BlockedEmailDomainRepository } from "@src/workload-abuse/repositories/blocked-email-domain/blocked-email-domain.repository";
import type { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import type { WorkloadAbuseInstrumentationService } from "@src/workload-abuse/services/workload-abuse-instrumentation/workload-abuse-instrumentation.service";
import { BlockedEmailDomainService } from "./blocked-email-domain.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createBlockedEmailDomain } from "@test/seeders/blocked-email-domain.seeder";

describe(BlockedEmailDomainService.name, () => {
  describe("isBlockedEmail", () => {
    it("blocks an address whose domain has a blocked row", async () => {
      const { service, blockedEmailDomainRepository } = setup({ row: createBlockedEmailDomain({ domain: "attacker.com", status: "blocked" }) });

      await expect(service.isBlockedEmail("miner@attacker.com")).resolves.toBe(true);
      expect(blockedEmailDomainRepository.findNearestRule).toHaveBeenCalledWith("attacker.com");
    });

    it("allows an address whose domain an operator has explicitly allowed", async () => {
      const { service } = setup({ row: createBlockedEmailDomain({ domain: "customer.com", status: "allowed" }) });

      await expect(service.isBlockedEmail("someone@customer.com")).resolves.toBe(false);
    });

    it("blocks an address on a subdomain whose nearest rule is a block on a parent domain", async () => {
      const { service, blockedEmailDomainRepository } = setup({ row: createBlockedEmailDomain({ domain: "attacker.com", status: "blocked" }) });

      await expect(service.isBlockedEmail("miner@eu.mail.attacker.com")).resolves.toBe(true);
      expect(blockedEmailDomainRepository.findNearestRule).toHaveBeenCalledWith("eu.mail.attacker.com");
    });

    it("allows an address on a subdomain whose nearest rule is an allow", async () => {
      const { service } = setup({ row: createBlockedEmailDomain({ domain: "mail.customer.com", status: "allowed" }) });

      await expect(service.isBlockedEmail("someone@mail.customer.com")).resolves.toBe(false);
    });

    it("allows an address whose domain has no row", async () => {
      const { service } = setup();

      await expect(service.isBlockedEmail("someone@unknown.com")).resolves.toBe(false);
    });

    it("looks up the normalized domain of a mixed-case address", async () => {
      const { service, blockedEmailDomainRepository } = setup();

      await service.isBlockedEmail("Miner@Attacker.COM");

      expect(blockedEmailDomainRepository.findNearestRule).toHaveBeenCalledWith("attacker.com");
    });

    it("allows an address it cannot parse without consulting the repository", async () => {
      const { service, blockedEmailDomainRepository } = setup();

      await expect(service.isBlockedEmail("not-an-address")).resolves.toBe(false);
      expect(blockedEmailDomainRepository.findNearestRule).not.toHaveBeenCalled();
    });

    it("allows every address without consulting the repository while the flag is off", async () => {
      const { service, blockedEmailDomainRepository } = setup({
        isFlagEnabled: false,
        row: createBlockedEmailDomain({ domain: "attacker.com", status: "blocked" })
      });

      await expect(service.isBlockedEmail("miner@attacker.com")).resolves.toBe(false);
      expect(blockedEmailDomainRepository.findNearestRule).not.toHaveBeenCalled();
    });

    it("decides the enforcement flag for the normalized domain being checked", async () => {
      const { service, featureFlagsService } = setup();

      await service.isBlockedEmail("Someone@Unknown.COM");

      expect(featureFlagsService.isEnabledForSubject).toHaveBeenCalledWith(FeatureFlags.BLOCKED_EMAIL_DOMAIN_ENFORCEMENT, "unknown.com");
    });

    it("answers a repeated lookup from the cache", async () => {
      const { service, blockedEmailDomainRepository } = setup({ row: createBlockedEmailDomain({ domain: "attacker.com", status: "blocked" }) });

      await service.isBlockedEmail("one@attacker.com");
      await service.isBlockedEmail("two@attacker.com");

      expect(blockedEmailDomainRepository.findNearestRule).toHaveBeenCalledTimes(1);
    });

    it("caches a negative so a legitimate domain does not reach the database on every login", async () => {
      const { service, blockedEmailDomainRepository } = setup();

      await service.isBlockedEmail("someone@customer.com");
      await service.isBlockedEmail("someone.else@customer.com");

      expect(blockedEmailDomainRepository.findNearestRule).toHaveBeenCalledTimes(1);
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
      expect(blockedEmailDomainRepository.findNearestRule).not.toHaveBeenCalled();
    });
  });

  describe("when the lookup fails", () => {
    it("allows the address and records the failure", async () => {
      const { service, logger, instrumentation } = setup({ lookupError: new Error("connection terminated") });

      await expect(service.isBlockedEmail("miner@attacker.com")).resolves.toBe(false);
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "BLOCKED_EMAIL_DOMAIN_LOOKUP_FAILED", domain: "attacker.com" }));
      expect(instrumentation.recordBlockedDomainLookupFailure).toHaveBeenCalledTimes(1);
    });

    it("retries the next lookup rather than caching the failure", async () => {
      const { service, blockedEmailDomainRepository } = setup({ lookupError: new Error("connection terminated") });

      await service.isBlockedEmail("miner@attacker.com");
      await service.isBlockedEmail("miner@attacker.com");

      expect(blockedEmailDomainRepository.findNearestRule).toHaveBeenCalledTimes(2);
    });
  });

  describe("rememberBlocked", () => {
    it("answers a following lookup without reading the row it was just told about", async () => {
      const { service, blockedEmailDomainRepository } = setup();

      service.rememberBlocked("attacker.com");

      await expect(service.isBlockedEmail("miner@attacker.com")).resolves.toBe(true);
      expect(blockedEmailDomainRepository.findNearestRule).not.toHaveBeenCalled();
    });

    it("drops the verdicts cached for its subdomains, so they are read again", async () => {
      const { service, blockedEmailDomainRepository } = setup();
      await service.isBlockedEmail("miner@mail.attacker.com");
      await service.isBlockedEmail("miner@eu.mail.attacker.com");
      await service.isBlockedEmail("someone@xattacker.com");
      blockedEmailDomainRepository.findNearestRule.mockResolvedValue(createBlockedEmailDomain({ domain: "attacker.com", status: "blocked" }));

      service.rememberBlocked("attacker.com");

      await expect(service.isBlockedEmail("miner@mail.attacker.com")).resolves.toBe(true);
      await expect(service.isBlockedEmail("miner@eu.mail.attacker.com")).resolves.toBe(true);
      await expect(service.isBlockedEmail("someone@xattacker.com")).resolves.toBe(false);
      expect(blockedEmailDomainRepository.findNearestRule).toHaveBeenCalledTimes(5);
    });
  });

  it("registers itself so a registry-wide clear empties it", async () => {
    const { service, blockedEmailDomainRepository } = setup();
    service.rememberBlocked("attacker.com");

    cacheRegistry.clearAll();
    await service.isBlockedEmail("miner@attacker.com");

    expect(cacheRegistry.getStats().some(stats => stats.name.startsWith(BlockedEmailDomainService.name))).toBe(true);
    expect(blockedEmailDomainRepository.findNearestRule).toHaveBeenCalledWith("attacker.com");
  });

  function setup(input?: { row?: ReturnType<typeof createBlockedEmailDomain>; isFlagEnabled?: boolean; lookupError?: Error; ttlSeconds?: number }) {
    const findNearestRule = input?.lookupError ? vi.fn().mockRejectedValue(input.lookupError) : vi.fn().mockResolvedValue(input?.row);
    const blockedEmailDomainRepository = mock<BlockedEmailDomainRepository>({ findNearestRule });
    const featureFlagsService = mock<FeatureFlagsService>({ isEnabledForSubject: vi.fn().mockReturnValue(input?.isFlagEnabled ?? true) });
    const workloadAbuseConfigService = mockConfigService<WorkloadAbuseConfigService>({
      WORKLOAD_ABUSE_BLOCKED_DOMAIN_CACHE_TTL_SECONDS: input?.ttlSeconds ?? 60
    });
    const instrumentation = mock<WorkloadAbuseInstrumentationService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new BlockedEmailDomainService(blockedEmailDomainRepository, featureFlagsService, instrumentation, workloadAbuseConfigService, createLogger);

    return { service, blockedEmailDomainRepository, featureFlagsService, instrumentation, workloadAbuseConfigService, logger, createLogger };
  }
});
