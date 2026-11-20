import type { MxRecord } from "node:dns";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

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
      mx: { "step-sis.help": [{ exchange: "Mail.Step-Sis.Help.", priority: 10 }, { exchange: "mx.backup-provider.net", priority: 20 }] },
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
      mx: { "bayudummy.web.id": [{ exchange: "route2.mx.cloudflare.net", priority: 22 }, { exchange: "route1.mx.cloudflare.net", priority: 79 }] }
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

  function setup(input: { mx?: Record<string, MxRecord[]>; a?: Record<string, string[]>; aaaa?: Record<string, string[]> } = {}) {
    const resolver = mock<DnsResolver>({
      resolveMx: vi.fn(async (host: string) => answerOrNoData(input.mx, host)),
      resolve4: vi.fn(async (host: string) => answerOrNoData(input.a, host)),
      resolve6: vi.fn(async (host: string) => answerOrNoData(input.aaaa, host))
    });
    const repository = mock<EmailDomainMailHostRepository>({ upsertProfile: vi.fn().mockResolvedValue(undefined) });
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
