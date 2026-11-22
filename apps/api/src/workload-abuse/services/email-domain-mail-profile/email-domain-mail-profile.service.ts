import { PromisePool } from "@supercharge/promise-pool";
import { LRUCache } from "lru-cache";
import type { MxRecord } from "node:dns";
import { inject, singleton } from "tsyringe";

import { cacheRegistry, nominalEntrySizing } from "@src/caching/cache-registry";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { TxService } from "@src/core/services/tx/tx.service";
import { getRegistrableDomain, isWithinDomain } from "@src/workload-abuse/lib/email-domain/email-domain";
import { isPublicIpv4 } from "@src/workload-abuse/lib/public-ipv4/public-ipv4";
import { DNS_RESOLVER, type DnsResolver } from "@src/workload-abuse/providers/dns-resolver.provider";
import {
  EmailDomainMailHostRepository,
  type EmailDomainMailProfile } from "@src/workload-abuse/repositories/email-domain-mail-host/email-domain-mail-host.repository";

const MAX_PROFILED_DOMAINS = 5_000;
const PROFILE_ENTRY_BYTES = 512;
const PROFILE_TTL_MS = 60 * 60 * 1000;

/** The domain owner decides how many records it publishes, so these bound the lookups and the row a hostile domain can cost us. */
const MAX_MX_HOSTS = 10;
const MAX_SELF_HOSTED_MX_IPS = 16;

/** Bounds one sweep run so a mass block is worked off over several runs instead of outliving the CronJob's deadline. */
const MAX_BLOCKED_DOMAINS_PER_SWEEP = 500;
const BLOCKED_DOMAIN_SWEEP_CONCURRENCY = 8;

const ABSENT_RECORD_CODES: ReadonlySet<string> = new Set(["ENODATA", "ENOTFOUND"]);

@singleton()
export class EmailDomainMailProfileService {
  readonly #profiles: LRUCache<string, EmailDomainMailProfile>;
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    @inject(DNS_RESOLVER) private readonly resolver: DnsResolver,
    private readonly emailDomainMailHostRepository: EmailDomainMailHostRepository,
    private readonly txService: TxService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#profiles = new LRUCache({ max: MAX_PROFILED_DOMAINS, ttl: PROFILE_TTL_MS, ...nominalEntrySizing(MAX_PROFILED_DOMAINS, PROFILE_ENTRY_BYTES) });
    cacheRegistry.register(EmailDomainMailProfileService.name, this.#profiles);
    this.logger = createLogger({ context: EmailDomainMailProfileService.name });
  }

  /** Null when DNS cannot answer, so a nameserver outage withholds the signals instead of making every domain look empty. */
  async findProfile(domain: string): Promise<EmailDomainMailProfile | null> {
    const cached = this.#profiles.get(domain);
    if (cached) return cached;

    const profile = await this.#resolveProfile(domain);
    if (!profile) return null;

    this.#profiles.set(domain, profile);
    await this.#saveProfile(profile);

    return profile;
  }

  async recordProfile(domain: string): Promise<void> {
    await this.findProfile(domain);
  }

  /** The admin console writes blocks straight into the table, and a blocked domain's own sign-ups are refused before the hold looks it up, so nothing else records its mail servers. */
  async recordMissingBlockedDomainProfiles(): Promise<{ found: number; recorded: number }> {
    const domains = await this.emailDomainMailHostRepository.findBlockedDomainsWithoutProfile(MAX_BLOCKED_DOMAINS_PER_SWEEP);
    const { results } = await PromisePool.withConcurrency(BLOCKED_DOMAIN_SWEEP_CONCURRENCY)
      .for(domains)
      .process(async domain => await this.findProfile(domain));
    const summary = { found: domains.length, recorded: results.filter(Boolean).length };

    this.logger.info({ event: "BLOCKED_EMAIL_DOMAIN_PROFILES_RECORDED", ...summary });

    return summary;
  }

  async #resolveProfile(domain: string): Promise<EmailDomainMailProfile | null> {
    try {
      const [mxRecords, domainIpv4, domainIpv6, wwwIpv4, wwwIpv6] = await Promise.all([
        this.#resolveOrEmpty(() => this.resolver.resolveMx(domain)),
        this.#resolveOrEmpty(() => this.resolver.resolve4(domain)),
        this.#resolveOrEmpty(() => this.resolver.resolve6(domain)),
        this.#resolveOrEmpty(() => this.resolver.resolve4(`www.${domain}`)),
        this.#resolveOrEmpty(() => this.resolver.resolve6(`www.${domain}`))
      ]);
      const mxHosts = selectPreferredMxHosts(mxRecords);
      const selfHostedMxIps = await this.#resolveSelfHostedMxIps(domain, mxHosts);
      const hasWebsite = [...domainIpv4, ...wwwIpv4].some(isPublicIpv4) || domainIpv6.length + wwwIpv6.length > 0;

      return { domain, mxHosts, selfHostedMxIps, hasWebsite };
    } catch (error) {
      this.logger.warn({ event: "EMAIL_DOMAIN_MAIL_PROFILE_LOOKUP_FAILED", domain, error });
      return null;
    }
  }

  async #resolveSelfHostedMxIps(domain: string, mxHosts: string[]): Promise<string[]> {
    const ownDomain = getRegistrableDomain(domain) ?? domain;
    const selfHostedMxHosts = mxHosts.filter(host => isWithinDomain(host, ownDomain));
    const addresses = await Promise.all(selfHostedMxHosts.map(host => this.#resolveOrEmpty(() => this.resolver.resolve4(host))));

    return sortedUnique(addresses.flat().filter(isPublicIpv4)).slice(0, MAX_SELF_HOSTED_MX_IPS);
  }

  async #resolveOrEmpty<T>(resolve: () => Promise<T[]>): Promise<T[]> {
    try {
      return await resolve();
    } catch (error) {
      if (isAbsentRecordError(error)) return [];
      throw error;
    }
  }

  /** Written outside the activation's transaction, which a hold rolls back by throwing. */
  async #saveProfile(profile: EmailDomainMailProfile): Promise<void> {
    try {
      await this.txService.outsideTransaction(async () => await this.emailDomainMailHostRepository.upsertProfile(profile));
    } catch (error) {
      this.logger.error({ event: "EMAIL_DOMAIN_MAIL_PROFILE_SAVE_FAILED", domain: profile.domain, error });
    }
  }
}

function isAbsentRecordError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;

  return !!code && ABSENT_RECORD_CODES.has(code);
}

function selectPreferredMxHosts(mxRecords: MxRecord[]): string[] {
  const byPreference = [...mxRecords].sort((left, right) => left.priority - right.priority);
  const hosts = byPreference.map(record => normalizeHostName(record.exchange)).filter(Boolean);

  return sortedUnique(hosts.slice(0, MAX_MX_HOSTS));
}

function normalizeHostName(host: string): string {
  return host.toLowerCase().replace(/\.$/, "");
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort();
}
