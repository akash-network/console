import type { MxRecord } from "node:dns";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { cacheRegistry } from "@src/caching/cache-registry";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { TxService } from "@src/core/services/tx/tx.service";
import type { DnsResolver } from "@src/workload-abuse/providers/dns-resolver.provider";
import type { EmailDomainMailHostRepository } from "@src/workload-abuse/repositories/email-domain-mail-host/email-domain-mail-host.repository";
import { EmailDomainMailProfileService } from "./email-domain-mail-profile.service";

describe(EmailDomainMailProfileService.name, () => {
  it("names its logger after itself", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: EmailDomainMailProfileService.name });
  });

  it("resolves the mail hosts, the addresses of the ones named under the domain and whether it serves a website", async () => {
    const { service } = setup({
      mx: {
        "step-sis.help": [
          { exchange: "Mail.Step-Sis.Help.", priority: 10 },
          { exchange: "mx.backup-provider.net", priority: 20 }
        ]
      },
      a: { "step-sis.help": ["23.88.114.19"], "mail.step-sis.help": ["23.88.114.19", "23.88.114.20"], "mx.backup-provider.net": ["1.1.1.1"] }
    });

    const profile = await service.findProfile("step-sis.help");

    expect(profile).toEqual({
      domain: "step-sis.help",
      mxHosts: ["mail.step-sis.help", "mx.backup-provider.net"],
      selfHostedMxIps: ["23.88.114.19", "23.88.114.20"],
      hasWebsite: true
    });
  });

  it("treats mail hosts under the registrable domain as self-hosted for an address on a subdomain", async () => {
    const { service } = setup({
      mx: { "eu.example-corp.com": [{ exchange: "mail.example-corp.com", priority: 10 }] },
      a: { "mail.example-corp.com": ["45.10.0.1"] }
    });

    const profile = await service.findProfile("eu.example-corp.com");

    expect(profile?.selfHostedMxIps).toEqual(["45.10.0.1"]);
  });

  it("reports no website for a domain that only forwards mail", async () => {
    const { service } = setup({
      mx: {
        "bayudummy.web.id": [
          { exchange: "route2.mx.cloudflare.net", priority: 22 },
          { exchange: "route1.mx.cloudflare.net", priority: 79 }
        ]
      }
    });

    const profile = await service.findProfile("bayudummy.web.id");

    expect(profile).toEqual({
      domain: "bayudummy.web.id",
      mxHosts: ["route1.mx.cloudflare.net", "route2.mx.cloudflare.net"],
      selfHostedMxIps: [],
      hasWebsite: false
    });
  });

  it("counts an IPv6 address or a www host as a website", async () => {
    const ipv6 = setup({ aaaa: { "ipv6-only.dev": ["2001:db8::1"] } });
    const www = setup({ a: { "www.www-only.dev": ["45.10.0.2"] } });
    const ipv6Www = setup({ aaaa: { "www.ipv6-www.dev": ["2001:db8::2"] } });

    expect((await ipv6.service.findProfile("ipv6-only.dev"))?.hasWebsite).toBe(true);
    expect((await www.service.findProfile("www-only.dev"))?.hasWebsite).toBe(true);
    expect((await ipv6Www.service.findProfile("ipv6-www.dev"))?.hasWebsite).toBe(true);
  });

  it("does not count a placeholder address as a website", async () => {
    const placeholder = setup({ a: { "parked.dev": ["127.0.0.1"], "www.parked.dev": ["10.0.0.5"] } });
    const mixed = setup({ a: { "mixed.dev": ["127.0.0.1", "45.10.0.7"] } });

    expect((await placeholder.service.findProfile("parked.dev"))?.hasWebsite).toBe(false);
    expect((await mixed.service.findProfile("mixed.dev"))?.hasWebsite).toBe(true);
  });

  it("registers its cache so a registry-wide clear empties it", async () => {
    const { service, resolver } = setup({ a: { "example-corp.com": ["45.10.0.3"] } });
    await service.findProfile("example-corp.com");

    cacheRegistry.clearAll();
    await service.findProfile("example-corp.com");

    expect(cacheRegistry.getStats().some(stats => stats.name.startsWith(EmailDomainMailProfileService.name))).toBe(true);
    expect(resolver.resolveMx).toHaveBeenCalledTimes(2);
  });

  it("keeps only the ten most preferred mail hosts and looks up only those", async () => {
    const mxRecords = Array.from({ length: 12 }, (_, index) => ({ exchange: `mx${index}.many-mx.dev`, priority: 100 - index }));
    const { service, resolver } = setup({ mx: { "many-mx.dev": mxRecords } });

    const profile = await service.findProfile("many-mx.dev");

    expect(profile?.mxHosts).toHaveLength(10);
    expect(profile?.mxHosts).not.toContain("mx0.many-mx.dev");
    expect(profile?.mxHosts).not.toContain("mx1.many-mx.dev");
    expect(resolver.resolve4).not.toHaveBeenCalledWith("mx0.many-mx.dev");
    expect(resolver.resolve4).toHaveBeenCalledWith("mx11.many-mx.dev");
  });

  it("keeps at most sixteen mail server addresses", async () => {
    const addresses = Array.from({ length: 20 }, (_, index) => `45.10.0.${index + 10}`);
    const { service } = setup({ mx: { "many-ips.dev": [{ exchange: "mail.many-ips.dev", priority: 10 }] }, a: { "mail.many-ips.dev": addresses } });

    const profile = await service.findProfile("many-ips.dev");

    expect(profile?.selfHostedMxIps).toEqual([...addresses].sort().slice(0, 16));
  });

  it("drops placeholder and private mail server addresses that unrelated domains share", async () => {
    const { service } = setup({
      mx: { "placeholder.dev": [{ exchange: "mail.placeholder.dev", priority: 10 }] },
      a: { "mail.placeholder.dev": ["127.0.0.1", "192.168.1.10", "45.10.0.9"] }
    });

    const profile = await service.findProfile("placeholder.dev");

    expect(profile?.selfHostedMxIps).toEqual(["45.10.0.9"]);
  });

  it("ignores a null MX record", async () => {
    const { service } = setup({ mx: { "no-mail.dev": [{ exchange: "", priority: 0 }] } });

    expect((await service.findProfile("no-mail.dev"))?.mxHosts).toEqual([]);
  });

  it("saves the profile outside the surrounding transaction", async () => {
    const { service, repository, txService } = setup({ a: { "example-corp.com": ["45.10.0.3"] } });

    const profile = await service.findProfile("example-corp.com");

    expect(txService.outsideTransaction).toHaveBeenCalledTimes(1);
    expect(repository.upsertProfile).toHaveBeenCalledWith(profile);
  });

  it("serves a repeated lookup from memory", async () => {
    const { service, resolver, repository } = setup({ a: { "example-corp.com": ["45.10.0.3"] } });

    const first = await service.findProfile("example-corp.com");
    const second = await service.findProfile("example-corp.com");

    expect(second).toBe(first);
    expect(resolver.resolveMx).toHaveBeenCalledTimes(1);
    expect(repository.upsertProfile).toHaveBeenCalledTimes(1);
  });

  it("returns no profile and logs when DNS fails for another reason than a missing record", async () => {
    const { service, resolver, repository, logger } = setup();
    const error = Object.assign(new Error("queryMx ETIMEOUT"), { code: "ETIMEOUT" });
    resolver.resolveMx.mockRejectedValue(error);

    const profile = await service.findProfile("slow-dns.dev");

    expect(profile).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith({ event: "EMAIL_DOMAIN_MAIL_PROFILE_LOOKUP_FAILED", domain: "slow-dns.dev", error });
    expect(repository.upsertProfile).not.toHaveBeenCalled();
  });

  it("retries a domain whose lookup failed", async () => {
    const { service, resolver } = setup({ a: { "flaky-dns.dev": ["45.10.0.4"] } });
    resolver.resolveMx.mockRejectedValueOnce(Object.assign(new Error("queryMx ESERVFAIL"), { code: "ESERVFAIL" }));

    expect(await service.findProfile("flaky-dns.dev")).toBeNull();
    expect(await service.findProfile("flaky-dns.dev")).toMatchObject({ domain: "flaky-dns.dev", hasWebsite: true });
  });

  it("treats a thrown value without a code as a failure", async () => {
    const { service, resolver } = setup();
    resolver.resolve4.mockRejectedValue("unexpected");

    expect(await service.findProfile("odd-failure.dev")).toBeNull();
  });

  it("still returns the profile and logs when it cannot be saved", async () => {
    const { service, repository, logger } = setup({ a: { "example-corp.com": ["45.10.0.3"] } });
    const error = new Error("database unavailable");
    repository.upsertProfile.mockRejectedValue(error);

    const profile = await service.findProfile("example-corp.com");

    expect(profile).toMatchObject({ domain: "example-corp.com" });
    expect(logger.error).toHaveBeenCalledWith({ event: "EMAIL_DOMAIN_MAIL_PROFILE_SAVE_FAILED", domain: "example-corp.com", error });
  });

  it("looks a domain up and saves it again on the next lookup after its save failed", async () => {
    const { service, resolver, repository } = setup({ a: { "example-corp.com": ["45.10.0.3"] } });
    repository.upsertProfile.mockRejectedValueOnce(new Error("database unavailable"));
    await service.findProfile("example-corp.com");

    const profile = await service.findProfile("example-corp.com");

    expect(profile).toMatchObject({ domain: "example-corp.com" });
    expect(resolver.resolveMx).toHaveBeenCalledTimes(2);
    expect(repository.upsertProfile).toHaveBeenCalledTimes(2);
  });

  describe("recordProfile", () => {
    it("looks up and stores the domain's mail servers", async () => {
      const { service, repository } = setup({
        mx: { "step-sis.help": [{ exchange: "mail.step-sis.help", priority: 10 }] },
        a: { "mail.step-sis.help": ["23.88.114.19"] }
      });

      const recorded = await service.recordProfile("step-sis.help");

      expect(recorded).toBe(true);
      expect(repository.upsertProfile).toHaveBeenCalledWith({
        domain: "step-sis.help",
        mxHosts: ["mail.step-sis.help"],
        selfHostedMxIps: ["23.88.114.19"],
        hasWebsite: false
      });
    });

    it("looks the domain up and saves it even when a cached profile exists", async () => {
      const { service, resolver, repository } = setup({ a: { "example-corp.com": ["45.10.0.3"] } });
      await service.findProfile("example-corp.com");

      const recorded = await service.recordProfile("example-corp.com");

      expect(recorded).toBe(true);
      expect(resolver.resolveMx).toHaveBeenCalledTimes(2);
      expect(repository.upsertProfile).toHaveBeenCalledTimes(2);
    });

    it("caches the profile it records for later lookups", async () => {
      const { service, resolver } = setup({ a: { "example-corp.com": ["45.10.0.3"] } });
      await service.recordProfile("example-corp.com");

      const profile = await service.findProfile("example-corp.com");

      expect(profile).toMatchObject({ domain: "example-corp.com", hasWebsite: true });
      expect(resolver.resolveMx).toHaveBeenCalledTimes(1);
    });

    it("reports nothing recorded when DNS fails", async () => {
      const { service, resolver, repository } = setup();
      resolver.resolveMx.mockRejectedValue(Object.assign(new Error("queryMx ETIMEOUT"), { code: "ETIMEOUT" }));

      expect(await service.recordProfile("slow-dns.dev")).toBe(false);
      expect(repository.upsertProfile).not.toHaveBeenCalled();
    });

    it("reports nothing recorded and logs when the profile cannot be saved", async () => {
      const { service, repository, logger } = setup({ a: { "example-corp.com": ["45.10.0.3"] } });
      const error = new Error("database unavailable");
      repository.upsertProfile.mockRejectedValue(error);

      expect(await service.recordProfile("example-corp.com")).toBe(false);
      expect(logger.error).toHaveBeenCalledWith({ event: "EMAIL_DOMAIN_MAIL_PROFILE_SAVE_FAILED", domain: "example-corp.com", error });
    });
  });

  describe("recordMissingBlockedDomainProfiles", () => {
    it("stores the mail servers of every blocked domain that has none, asking for a bounded batch", async () => {
      const { service, repository } = setup({
        blockedWithoutProfile: ["step-sis.help", "afronewz.com"],
        a: { "step-sis.help": ["23.88.114.19"], "afronewz.com": ["138.197.228.18"] }
      });

      const summary = await service.recordMissingBlockedDomainProfiles();

      expect(repository.findBlockedDomainsWithoutProfile).toHaveBeenCalledWith(500);
      expect(repository.upsertProfile).toHaveBeenCalledWith(expect.objectContaining({ domain: "step-sis.help" }));
      expect(repository.upsertProfile).toHaveBeenCalledWith(expect.objectContaining({ domain: "afronewz.com" }));
      expect(summary).toEqual({ found: 2, recorded: 2 });
    });

    it("counts a domain whose DNS fails as not recorded, so the next run retries it", async () => {
      const { service, resolver, repository, logger } = setup({
        blockedWithoutProfile: ["slow-dns.dev", "example-corp.com"],
        a: { "example-corp.com": ["45.10.0.3"] }
      });
      resolver.resolveMx.mockImplementation(async host => {
        if (host === "slow-dns.dev") throw Object.assign(new Error("queryMx ETIMEOUT"), { code: "ETIMEOUT" });
        throw Object.assign(new Error("queryMx ENODATA"), { code: "ENODATA" });
      });

      const summary = await service.recordMissingBlockedDomainProfiles();

      expect(summary).toEqual({ found: 2, recorded: 1 });
      expect(repository.upsertProfile).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith({ event: "BLOCKED_EMAIL_DOMAIN_PROFILES_RECORDED", found: 2, recorded: 1 });
    });

    it("counts a domain whose profile cannot be saved as not recorded", async () => {
      const { service, repository } = setup({
        blockedWithoutProfile: ["step-sis.help", "afronewz.com"],
        a: { "step-sis.help": ["23.88.114.19"], "afronewz.com": ["138.197.228.18"] }
      });
      repository.upsertProfile.mockImplementation(async profile => {
        if (profile.domain === "afronewz.com") throw new Error("database unavailable");
      });

      expect(await service.recordMissingBlockedDomainProfiles()).toEqual({ found: 2, recorded: 1 });
    });

    it("does nothing when every blocked domain already has its mail servers", async () => {
      const { service, resolver } = setup({ blockedWithoutProfile: [] });

      expect(await service.recordMissingBlockedDomainProfiles()).toEqual({ found: 0, recorded: 0 });
      expect(resolver.resolveMx).not.toHaveBeenCalled();
    });
  });

  function setup(
    input: { mx?: Record<string, MxRecord[]>; a?: Record<string, string[]>; aaaa?: Record<string, string[]>; blockedWithoutProfile?: string[] } = {}
  ) {
    const resolver = mock<DnsResolver>({
      resolveMx: vi.fn(async (host: string) => answerOrNoData(input.mx, host)),
      resolve4: vi.fn(async (host: string) => answerOrNoData(input.a, host)),
      resolve6: vi.fn(async (host: string) => answerOrNoData(input.aaaa, host))
    });
    const repository = mock<EmailDomainMailHostRepository>({
      upsertProfile: vi.fn().mockResolvedValue(undefined),
      findBlockedDomainsWithoutProfile: vi.fn().mockResolvedValue(input.blockedWithoutProfile ?? [])
    });
    const txService = mock<TxService>({ outsideTransaction: vi.fn(async cb => await cb()) });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const service = new EmailDomainMailProfileService(resolver, repository, txService, createLogger);

    return { service, resolver, repository, txService, logger, createLogger };
  }

  function answerOrNoData<T>(answers: Record<string, T[]> | undefined, host: string): T[] {
    const answer = answers?.[host];
    if (answer) return answer;

    throw Object.assign(new Error(`query ENODATA ${host}`), { code: host.startsWith("www.") ? "ENOTFOUND" : "ENODATA" });
  }
});
