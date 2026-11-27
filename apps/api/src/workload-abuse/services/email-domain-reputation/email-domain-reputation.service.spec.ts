import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { StripeTransactionRepository } from "@src/billing/repositories";
import type { UserOutput, UserRepository } from "@src/user/repositories";
import type {
  BlockedEmailDomainOutput,
  BlockedEmailDomainRepository
} from "@src/workload-abuse/repositories/blocked-email-domain/blocked-email-domain.repository";
import type {
  EmailDomainMailHostRepository,
  EmailDomainMailProfile
} from "@src/workload-abuse/repositories/email-domain-mail-host/email-domain-mail-host.repository";
import type { EmailDomainMailProfileService } from "@src/workload-abuse/services/email-domain-mail-profile/email-domain-mail-profile.service";
import type { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import { EmailDomainReputationService } from "./email-domain-reputation.service";

import { createUser } from "@test/seeders/user.seeder";
import { mockConfig } from "@test/services/mock-config.service";

describe(EmailDomainReputationService.name, () => {
  it("finds no signal for an ordinary private domain", async () => {
    const { service, user } = setup({ email: "dev@example-corp.com" });

    expect(await service.findSignals(user)).toEqual({ domain: "example-corp.com", signals: [] });
  });

  describe("when the mail server is shared with a blocked domain", () => {
    it("reports the blocked domain it shares the server with", async () => {
      const { service, user, mailHostRepository } = setup({
        email: "gzopyqjcc96@sendhelp.mom",
        profile: { selfHostedMxIps: ["23.88.114.19"] },
        blockedDomainSharingMxIps: "step-sis.help"
      });

      const { signals } = await service.findSignals(user);

      expect(signals).toEqual([{ signal: "mail_server_shared_with_blocked_domain", blockedDomain: "step-sis.help" }]);
      expect(mailHostRepository.findBlockedDomainSharingMxIps).toHaveBeenCalledWith(["23.88.114.19"], "sendhelp.mom");
    });
  });

  describe("when the domain only forwards mail", () => {
    it("reports a domain without a website", async () => {
      const { service, user } = setup({
        email: "anisa.kusuma75@bayudummy.web.id",
        profile: { mxHosts: ["route1.mx.cloudflare.net"], hasWebsite: false }
      });

      expect((await service.findSignals(user)).signals).toEqual([{ signal: "forwarding_only_without_website" }]);
    });

    it("ignores a domain that also serves a website", async () => {
      const { service, user } = setup({ email: "me@personal-site.dev", profile: { mxHosts: ["route1.mx.cloudflare.net"], hasWebsite: true } });

      expect((await service.findSignals(user)).signals).toEqual([]);
    });

    it("ignores a domain without a website whose mail is hosted", async () => {
      const { service, user } = setup({ email: "me@quiet-corp.dev", profile: { mxHosts: ["aspmx.l.google.com"], hasWebsite: false } });

      expect((await service.findSignals(user)).signals).toEqual([]);
    });
  });

  it("skips the mail server signals when the domain has no profile", async () => {
    const { service, user, mailHostRepository } = setup({ email: "me@slow-dns.dev", profile: null });

    expect((await service.findSignals(user)).signals).toEqual([]);
    expect(mailHostRepository.findBlockedDomainSharingMxIps).not.toHaveBeenCalled();
  });

  describe("when the domain signs up in a burst", () => {
    it("reports the sign-ups once they reach the configured minimum within the window", async () => {
      const { service, user, userRepository } = setup({ email: "teqz9009@step-sis.help", recentSignups: 5, burstMinSignups: 5, burstWindowHours: 12 });

      const { signals } = await service.findSignals(user);

      expect(signals).toEqual([{ signal: "signup_burst", burstDomain: "step-sis.help", signups: 5 }]);
      expect(userRepository.countVerifiedCreatedWithEmailDomainSince).toHaveBeenCalledWith("step-sis.help", 12);
    });

    it("counts the whole registrable domain for an address on a subdomain", async () => {
      const { service, user, userRepository } = setup({ email: "fawdtvw831@tempmail.tweaksph.com", recentSignups: 22 });

      const { signals } = await service.findSignals(user);

      expect(signals).toEqual([{ signal: "signup_burst", burstDomain: "tweaksph.com", signups: 22 }]);
      expect(userRepository.countVerifiedCreatedWithEmailDomainSince).toHaveBeenCalledWith("tweaksph.com", 24);
    });

    it("keeps owners on a shared suffix apart", async () => {
      const { service, user, userRepository } = setup({ email: "hendra.wijaya72@duskvale.web.id", recentSignups: 1 });

      await service.findSignals(user);

      expect(userRepository.countVerifiedCreatedWithEmailDomainSince).toHaveBeenCalledWith("duskvale.web.id", 24);
    });

    it("counts the domain itself when it has no registrable part", async () => {
      const { service, user, userRepository } = setup({ email: "someone@web.id", recentSignups: 1 });

      await service.findSignals(user);

      expect(userRepository.countVerifiedCreatedWithEmailDomainSince).toHaveBeenCalledWith("web.id", 24);
    });

    it("ignores sign-ups below the minimum", async () => {
      const { service, user, userRepository, stripeTransactionRepository } = setup({
        email: "teqz9009@step-sis.help",
        recentSignups: 4,
        burstMinSignups: 5,
        hasPaidUser: true,
        hasEstablishedUser: true
      });

      expect((await service.findSignals(user)).signals).toEqual([]);
      expect(stripeTransactionRepository.hasPaidUserWithEmailDomain).not.toHaveBeenCalled();
      expect(userRepository.hasEstablishedUserWithEmailDomain).not.toHaveBeenCalled();
    });

    it("ignores a burst on a domain somebody has paid from", async () => {
      const { service, user, userRepository, stripeTransactionRepository } = setup({
        email: "new.hire@mail.example-corp.com",
        recentSignups: 6,
        hasPaidUser: true
      });

      expect((await service.findSignals(user)).signals).toEqual([]);
      expect(stripeTransactionRepository.hasPaidUserWithEmailDomain).toHaveBeenCalledWith("example-corp.com");
      expect(userRepository.hasEstablishedUserWithEmailDomain).not.toHaveBeenCalled();
    });

    it("ignores a burst on a domain with an account older than the configured age, not counting the sign-up itself", async () => {
      const { service, user, userRepository } = setup({
        email: "new.hire@mail.example-corp.com",
        recentSignups: 6,
        hasEstablishedUser: true,
        minAccountAgeDays: 21
      });

      expect((await service.findSignals(user)).signals).toEqual([]);
      expect(userRepository.hasEstablishedUserWithEmailDomain).toHaveBeenCalledWith("example-corp.com", 21, user.id);
    });

    it("reports a burst on a domain with neither a paying nor an established account", async () => {
      const { service, user } = setup({ email: "teqz9009@step-sis.help", recentSignups: 6, hasPaidUser: false, hasEstablishedUser: false });

      expect((await service.findSignals(user)).signals).toEqual([{ signal: "signup_burst", burstDomain: "step-sis.help", signups: 6 }]);
    });

    it("ignores a burst that stays under the minimum", async () => {
      const { service, user } = setup({ email: "teqz9009@step-sis.help", recentSignups: 4, burstMinSignups: 5 });

      expect((await service.findSignals(user)).signals).toEqual([]);
    });
  });

  describe("when the device is shared with a blocked domain", () => {
    it("reports the linked account and the rule that blocks its domain", async () => {
      const linkedUserId = faker.string.uuid();
      const { service, user, userRepository, blockedEmailDomainRepository } = setup({
        email: "someone@gmail.com",
        linkedAccounts: [
          { id: faker.string.uuid(), email: "other@gmail.com" },
          { id: faker.string.uuid(), email: "fine@example-corp.com" },
          { id: linkedUserId, email: "hscmkuv427@mail.gaanja.garden" }
        ],
        blockedDomains: ["gaanja.garden"]
      });

      const { signals } = await service.findSignals(user);

      expect(signals).toEqual([{ signal: "device_shared_with_blocked_domain", linkedUserId, blockedDomain: "gaanja.garden" }]);
      expect(userRepository.findRecentlyActiveByFingerprint).toHaveBeenCalledWith(user.lastFingerprint, user.id, 45);
      expect(blockedEmailDomainRepository.findNearestRule).not.toHaveBeenCalledWith("gmail.com");
    });

    it("ignores linked accounts whose domain an operator allowed or never ruled on", async () => {
      const { service, user } = setup({
        email: "someone@gmail.com",
        linkedAccounts: [
          { id: faker.string.uuid(), email: "fine@example-corp.com" },
          { id: faker.string.uuid(), email: null }
        ],
        allowedDomains: ["example-corp.com"]
      });

      expect((await service.findSignals(user)).signals).toEqual([]);
    });

    it("looks nothing up without a review window or a fingerprint", async () => {
      const noWindow = setup({ email: "someone@gmail.com", windowMinutes: undefined });
      const noFingerprint = setup({ user: createUser({ email: "someone@gmail.com", lastFingerprint: null }) });

      expect((await noWindow.service.findSignals(noWindow.user)).signals).toEqual([]);
      expect((await noFingerprint.service.findSignals(noFingerprint.user)).signals).toEqual([]);
      expect(noWindow.userRepository.findRecentlyActiveByFingerprint).not.toHaveBeenCalled();
      expect(noFingerprint.userRepository.findRecentlyActiveByFingerprint).not.toHaveBeenCalled();
    });
  });

  it("checks only the device of a domain an operator allowed", async () => {
    const { service, user, profileService, userRepository, blockedEmailDomainRepository } = setup({
      email: "team@forwarding-startup.dev",
      profile: { mxHosts: ["route1.mx.cloudflare.net"], hasWebsite: false },
      recentSignups: 9,
      allowedDomains: ["forwarding-startup.dev"]
    });

    expect(await service.findSignals(user)).toEqual({ domain: "forwarding-startup.dev", signals: [] });
    expect(blockedEmailDomainRepository.findNearestRule).toHaveBeenCalledWith("forwarding-startup.dev");
    expect(profileService.findProfile).not.toHaveBeenCalled();
    expect(userRepository.countVerifiedCreatedWithEmailDomainSince).not.toHaveBeenCalled();
    expect(userRepository.findRecentlyActiveByFingerprint).toHaveBeenCalled();
  });

  it("checks only the device of a public provider address", async () => {
    const { service, user, profileService, userRepository } = setup({ email: "someone@gmail.com", recentSignups: 100 });

    expect(await service.findSignals(user)).toEqual({ domain: "gmail.com", signals: [] });
    expect(profileService.findProfile).not.toHaveBeenCalled();
    expect(userRepository.countVerifiedCreatedWithEmailDomainSince).not.toHaveBeenCalled();
    expect(userRepository.findRecentlyActiveByFingerprint).toHaveBeenCalled();
  });

  it("checks only the device of an address without a domain", async () => {
    const { service, user, profileService } = setup({ user: createUser({ email: null, lastFingerprint: faker.string.hexadecimal({ length: 64 }) }) });

    expect(await service.findSignals(user)).toEqual({ domain: null, signals: [] });
    expect(profileService.findProfile).not.toHaveBeenCalled();
  });

  it("reports every signal that applies", async () => {
    const { service, user } = setup({
      email: "imvldlpovx9558@step-sis.help",
      profile: { selfHostedMxIps: ["23.88.114.19"] },
      blockedDomainSharingMxIps: "gaanja.garden",
      recentSignups: 14
    });

    const { signals } = await service.findSignals(user);

    expect(signals).toEqual([
      { signal: "mail_server_shared_with_blocked_domain", blockedDomain: "gaanja.garden" },
      { signal: "signup_burst", burstDomain: "step-sis.help", signups: 14 }
    ]);
  });

  function setup(
    input: {
      email?: string;
      user?: UserOutput;
      profile?: Partial<EmailDomainMailProfile> | null;
      blockedDomainSharingMxIps?: string;
      recentSignups?: number;
      burstMinSignups?: number;
      burstWindowHours?: number;
      linkedAccounts?: Pick<UserOutput, "id" | "email">[];
      blockedDomains?: string[];
      allowedDomains?: string[];
      windowMinutes?: number;
      hasPaidUser?: boolean;
      hasEstablishedUser?: boolean;
      minAccountAgeDays?: number;
    } = {}
  ) {
    const user = input.user ?? createUser({ email: input.email, lastFingerprint: faker.string.hexadecimal({ length: 64 }) });
    const domain = user.email?.split("@")[1] ?? "";
    const profile = input.profile === null ? null : { domain, mxHosts: [`mail.${domain}`], selfHostedMxIps: ["10.0.0.1"], hasWebsite: true, ...input.profile };
    const profileService = mock<EmailDomainMailProfileService>({ findProfile: vi.fn().mockResolvedValue(profile) });
    const mailHostRepository = mock<EmailDomainMailHostRepository>({
      findBlockedDomainSharingMxIps: vi.fn().mockResolvedValue(input.blockedDomainSharingMxIps)
    });
    const blockedEmailDomainRepository = mock<BlockedEmailDomainRepository>({
      findNearestRule: vi.fn(async (ruleDomain: string) => findRule(ruleDomain, input.blockedDomains, input.allowedDomains))
    });
    const userRepository = mock<UserRepository>({
      countVerifiedCreatedWithEmailDomainSince: vi.fn().mockResolvedValue(input.recentSignups ?? 1),
      hasEstablishedUserWithEmailDomain: vi.fn().mockResolvedValue(input.hasEstablishedUser ?? false),
      findRecentlyActiveByFingerprint: vi.fn().mockResolvedValue(input.linkedAccounts ?? [])
    });
    const stripeTransactionRepository = mock<StripeTransactionRepository>({
      hasPaidUserWithEmailDomain: vi.fn().mockResolvedValue(input.hasPaidUser ?? false)
    });
    const config = mockConfig<WorkloadAbuseConfigService>({
      WORKLOAD_ABUSE_DOMAIN_BLOCK_MIN_ACCOUNT_AGE_DAYS: input.minAccountAgeDays ?? 30,
      WORKLOAD_ABUSE_SIGNUP_REVIEW_WINDOW_MINUTES: "windowMinutes" in input ? input.windowMinutes : 45,
      WORKLOAD_ABUSE_EMAIL_DOMAIN_BURST_MIN_SIGNUPS: input.burstMinSignups ?? 5,
      WORKLOAD_ABUSE_EMAIL_DOMAIN_BURST_WINDOW_HOURS: input.burstWindowHours ?? 24
    });
    const service = new EmailDomainReputationService(
      profileService,
      mailHostRepository,
      blockedEmailDomainRepository,
      userRepository,
      stripeTransactionRepository,
      config
    );

    return { service, user, profileService, mailHostRepository, blockedEmailDomainRepository, userRepository, stripeTransactionRepository };
  }

  function findRule(domain: string, blockedDomains: string[] = [], allowedDomains: string[] = []): BlockedEmailDomainOutput | undefined {
    const blocked = blockedDomains.find(blockedDomain => domain === blockedDomain || domain.endsWith(`.${blockedDomain}`));
    if (blocked) return mock<BlockedEmailDomainOutput>({ domain: blocked, status: "blocked" });

    const allowed = allowedDomains.find(allowedDomain => domain === allowedDomain);
    return allowed ? mock<BlockedEmailDomainOutput>({ domain: allowed, status: "allowed" }) : undefined;
  }
});
