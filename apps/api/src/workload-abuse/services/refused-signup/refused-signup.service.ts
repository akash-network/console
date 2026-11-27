import { subMinutes } from "date-fns";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { type Browser, hashBrowser } from "@src/workload-abuse/lib/account-hashes/account-hashes";
import { RefusedSignupRepository } from "@src/workload-abuse/repositories/refused-signup/refused-signup.repository";
import { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";

@singleton()
export class RefusedSignupService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly refusedSignupRepository: RefusedSignupRepository,
    private readonly config: WorkloadAbuseConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: RefusedSignupService.name });
  }

  /** Never throws, since the caller is about to answer the refusal and a lost record only costs one hold. */
  async remember(browser: Browser): Promise<void> {
    if (this.config.get("WORKLOAD_ABUSE_REFUSED_SIGNUP_HOLD_MODE") === "off") return;

    const browserHash = this.#hash(browser);
    if (!browserHash) return;

    try {
      await this.refusedSignupRepository.deleteOlderThan(this.#windowStart());
      await this.refusedSignupRepository.create({ browserHash });
      this.logger.info({ event: "REFUSED_SIGNUP_REMEMBERED" });
    } catch (error) {
      this.logger.error({ event: "REFUSED_SIGNUP_NOT_REMEMBERED", error });
    }
  }

  async wasRecentlyRefused(browser: Browser): Promise<boolean> {
    const browserHash = this.#hash(browser);
    if (!browserHash) return false;

    return await this.refusedSignupRepository.existsSince(browserHash, this.#windowStart());
  }

  #windowStart(): Date {
    return subMinutes(new Date(), this.config.get("WORKLOAD_ABUSE_REFUSED_SIGNUP_HOLD_WINDOW_MINUTES"));
  }

  #hash(browser: Browser): string | null {
    return hashBrowser(this.config.get("WORKLOAD_ABUSE_ACCOUNT_HASH_SECRET"), browser);
  }
}
