import { LRUCache } from "lru-cache";
import { inject, singleton } from "tsyringe";

import { cacheRegistry, nominalEntrySizing } from "@src/caching/cache-registry";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { extractEmailDomain, normalizeEmailDomain } from "@src/workload-abuse/lib/email-domain/email-domain";
import { BlockedEmailDomainRepository } from "@src/workload-abuse/repositories/blocked-email-domain/blocked-email-domain.repository";
import { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";

const MAX_TRACKED_DOMAINS = 20_000;
/** A boolean under a domain string, so the registry ranks this cache far below the ones holding response payloads. */
const ENTRY_BYTES = 64;

/**
 * Answers whether an address may create an account or start a trial. Negatives are cached as well as positives,
 * because a legitimate address is the common case and it is the one that must not reach Postgres on every login.
 */
@singleton()
export class BlockedEmailDomainService {
  readonly #verdicts: LRUCache<string, boolean>;
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly blockedEmailDomainRepository: BlockedEmailDomainRepository,
    private readonly featureFlagsService: FeatureFlagsService,
    workloadAbuseConfigService: WorkloadAbuseConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#verdicts = new LRUCache({
      max: MAX_TRACKED_DOMAINS,
      ttl: workloadAbuseConfigService.get("WORKLOAD_ABUSE_BLOCKED_DOMAIN_CACHE_TTL_SECONDS") * 1000,
      ...nominalEntrySizing(MAX_TRACKED_DOMAINS, ENTRY_BYTES)
    });
    cacheRegistry.register(BlockedEmailDomainService.name, this.#verdicts);
    this.logger = createLogger({ context: BlockedEmailDomainService.name });
  }

  async isBlockedEmail(email: string | null | undefined): Promise<boolean> {
    return await this.#isBlocked(extractEmailDomain(email));
  }

  async isBlockedDomain(domain: string | null | undefined): Promise<boolean> {
    return await this.#isBlocked(normalizeEmailDomain(domain));
  }

  /** Primes the verdict we just wrote so a sibling sweep on the same pod does not wait out a stale negative. */
  rememberBlocked(domain: string): void {
    this.#verdicts.set(domain, true);
  }

  async #isBlocked(domain: string | null): Promise<boolean> {
    if (!domain) return false;
    if (!this.featureFlagsService.isEnabled(FeatureFlags.BLOCKED_EMAIL_DOMAIN_ENFORCEMENT)) return false;

    const cached = this.#verdicts.get(domain);
    if (cached !== undefined) return cached;

    try {
      const blocked = (await this.blockedEmailDomainRepository.findByDomain(domain))?.status === "blocked";
      this.#verdicts.set(domain, blocked);
      return blocked;
    } catch (error) {
      this.logger.error({ event: "BLOCKED_EMAIL_DOMAIN_LOOKUP_FAILED", domain, error });
      return false;
    }
  }
}
