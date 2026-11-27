import { singleton } from "tsyringe";

import { StripeTransactionRepository } from "@src/billing/repositories";
import { type UserOutput, UserRepository } from "@src/user/repositories";
import { extractEmailDomain, getRegistrableDomain } from "@src/workload-abuse/lib/email-domain/email-domain";
import { isPublicEmailProvider } from "@src/workload-abuse/lib/email-domain/public-email-providers";
import { isForwardingOnly } from "@src/workload-abuse/lib/mail-forwarding/mail-forwarding";
import { BlockedEmailDomainRepository } from "@src/workload-abuse/repositories/blocked-email-domain/blocked-email-domain.repository";
import { EmailDomainMailHostRepository } from "@src/workload-abuse/repositories/email-domain-mail-host/email-domain-mail-host.repository";
import { EmailDomainMailProfileService } from "@src/workload-abuse/services/email-domain-mail-profile/email-domain-mail-profile.service";
import { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";

export type EmailDomainSignal =
  | { signal: "mail_server_shared_with_blocked_domain"; blockedDomain: string }
  | { signal: "device_shared_with_blocked_domain"; linkedUserId: string; blockedDomain: string }
  | { signal: "signup_burst"; burstDomain: string; signups: number }
  | { signal: "forwarding_only_without_website" };

type AssessedUser = Pick<UserOutput, "id" | "email" | "lastFingerprint">;

export type EmailDomainAssessment = { domain: string | null; signals: EmailDomainSignal[] };

export type SignupBurst = { burstDomain: string; signups: number };

type SignupBurstLimits = { minSignups: number; windowHours: number };

/** Public providers skip the domain signals, since millions of unrelated people share them, but a device shared with a blocked domain still counts for them. */
@singleton()
export class EmailDomainReputationService {
  constructor(
    private readonly emailDomainMailProfileService: EmailDomainMailProfileService,
    private readonly emailDomainMailHostRepository: EmailDomainMailHostRepository,
    private readonly blockedEmailDomainRepository: BlockedEmailDomainRepository,
    private readonly userRepository: UserRepository,
    private readonly stripeTransactionRepository: StripeTransactionRepository,
    private readonly config: WorkloadAbuseConfigService
  ) {}

  async findSignals(user: AssessedUser): Promise<EmailDomainAssessment> {
    const domain = extractEmailDomain(user.email);

    const signals = await Promise.all([this.#findDeviceSharedWithBlockedDomain(user), domain ? this.#findDomainSignals(domain, user.id) : []]);

    return { domain, signals: signals.flat() };
  }

  /** Answers for the sign-up burst alone, so a rule with limits of its own can ask without the mail-server and device signals. */
  async findSignupBurst(user: AssessedUser, limits: SignupBurstLimits): Promise<SignupBurst | null> {
    const domain = extractEmailDomain(user.email);
    if (!domain || !(await this.#isAssessed(domain))) return null;

    return await this.#findBurst(domain, user.id, limits);
  }

  async #findDomainSignals(domain: string, userId: UserOutput["id"]): Promise<EmailDomainSignal[]> {
    if (!(await this.#isAssessed(domain))) return [];

    const signals = await Promise.all([this.#findMailServerSignals(domain), this.#findSignupBurstSignal(domain, userId)]);

    return signals.flat();
  }

  /** An operator's allow on the domain or a parent exempts it, so a reviewed false positive can be cleared for one domain without changing the mode. */
  async #isAssessed(domain: string): Promise<boolean> {
    if (isPublicEmailProvider(domain)) return false;

    return (await this.blockedEmailDomainRepository.findNearestRule(domain))?.status !== "allowed";
  }

  async #findMailServerSignals(domain: string): Promise<EmailDomainSignal[]> {
    const profile = await this.emailDomainMailProfileService.findProfile(domain);
    if (!profile) return [];

    const signals: EmailDomainSignal[] = [];
    const blockedDomain = await this.emailDomainMailHostRepository.findBlockedDomainSharingMxIps(profile.selfHostedMxIps, domain);

    if (blockedDomain) signals.push({ signal: "mail_server_shared_with_blocked_domain", blockedDomain });
    if (!profile.hasWebsite && isForwardingOnly(profile.mxHosts)) signals.push({ signal: "forwarding_only_without_website" });

    return signals;
  }

  async #findDeviceSharedWithBlockedDomain(user: AssessedUser): Promise<EmailDomainSignal[]> {
    const windowMinutes = this.config.get("WORKLOAD_ABUSE_SIGNUP_REVIEW_WINDOW_MINUTES");
    if (!windowMinutes || !user.lastFingerprint) return [];

    const linkedAccounts = await this.userRepository.findRecentlyActiveByFingerprint(user.lastFingerprint, user.id, windowMinutes);
    const rules = await Promise.all(
      linkedAccounts.map(async account => {
        const domain = extractEmailDomain(account.email);
        const rule = domain && !isPublicEmailProvider(domain) ? await this.blockedEmailDomainRepository.findNearestRule(domain) : undefined;

        return { linkedUserId: account.id, rule };
      })
    );
    const blocked = rules.find(({ rule }) => rule?.status === "blocked");

    return blocked?.rule ? [{ signal: "device_shared_with_blocked_domain", linkedUserId: blocked.linkedUserId, blockedDomain: blocked.rule.domain }] : [];
  }

  async #findSignupBurstSignal(domain: string, userId: UserOutput["id"]): Promise<EmailDomainSignal[]> {
    const burst = await this.#findBurst(domain, userId, {
      minSignups: this.config.get("WORKLOAD_ABUSE_EMAIL_DOMAIN_BURST_MIN_SIGNUPS"),
      windowHours: this.config.get("WORKLOAD_ABUSE_EMAIL_DOMAIN_BURST_WINDOW_HOURS")
    });

    return burst ? [{ signal: "signup_burst", ...burst }] : [];
  }

  /** Counts the whole registrable domain, so rotating subdomains such as inbox. and tempmail. cannot keep each one under the minimum. */
  async #findBurst(domain: string, userId: UserOutput["id"], { minSignups, windowHours }: SignupBurstLimits): Promise<SignupBurst | null> {
    const burstDomain = getRegistrableDomain(domain) ?? domain;
    const signups = await this.userRepository.countVerifiedCreatedWithEmailDomainSince(burstDomain, windowHours);

    if (signups < minSignups) return null;
    if (await this.#hasPayingOrEstablishedAccount(burstDomain, userId)) return null;

    return { burstDomain, signups };
  }

  /** Deploying or creating API keys does not count, since farmed accounts do both on trial credit within minutes of signing up. */
  async #hasPayingOrEstablishedAccount(domain: string, excludeUserId: UserOutput["id"]): Promise<boolean> {
    if (await this.stripeTransactionRepository.hasPaidUserWithEmailDomain(domain)) return true;

    const minAccountAgeDays = this.config.get("WORKLOAD_ABUSE_DOMAIN_BLOCK_MIN_ACCOUNT_AGE_DAYS");

    return await this.userRepository.hasEstablishedUserWithEmailDomain(domain, minAccountAgeDays, excludeUserId);
  }
}
