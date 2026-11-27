import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger, JobQueueService } from "@src/core";
import type { TxService } from "@src/core/services/tx/tx.service";
import type { UserOutput, UserRepository } from "@src/user/repositories";
import { BlockEmailDomainOfHeldSignup, blockEmailDomainOfHeldSignupKeyFor } from "@src/workload-abuse/events/block-email-domain-of-held-signup";
import type { HeldSignupBlockEvidence } from "@src/workload-abuse/services/email-domain-block/email-domain-block.service";
import type {
  EmailDomainReputationService,
  EmailDomainSignal,
  SignupBurst
} from "@src/workload-abuse/services/email-domain-reputation/email-domain-reputation.service";
import type { RefusedSignupService } from "@src/workload-abuse/services/refused-signup/refused-signup.service";
import {
  ReviewNewEmailDomainSignups,
  reviewNewEmailDomainSignupsKeyFor
} from "@src/workload-abuse/services/review-new-email-domain-signups/review-new-email-domain-signups.handler";
import {
  ReviewTrialAfterRefusedSignup,
  reviewTrialAfterRefusedSignupKeyFor
} from "@src/workload-abuse/services/review-trial-after-refused-signup/review-trial-after-refused-signup.handler";
import { reviewHeldTrialSignupKeyFor, ReviewTrialSignup } from "@src/workload-abuse/services/review-trial-signup/review-trial-signup.handler";
import type { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import { TrialSignupHoldService } from "./trial-signup-hold.service";

import { createUser } from "@test/seeders/user.seeder";
import { mockConfig } from "@test/services/mock-config.service";

const DOMAIN = "sendhelp.mom";

describe(TrialSignupHoldService.name, () => {
  it("names its logger after itself", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: TrialSignupHoldService.name });
  });

  it("holds a trial once the linked accounts reach the threshold and reports it outside the transaction once per window", async () => {
    const { service, user, fingerprint, linkedAccounts, userRepository, jobQueueService, txService, logger } = setup({ mode: "enforce", linkedCount: 2 });

    const held = await service.isHeld(user);

    expect(held).toBe(true);
    expect(userRepository.findRecentlyActiveByFingerprint).toHaveBeenCalledWith(user.lastFingerprint, user.id, 45);
    expect(logger.warn).toHaveBeenCalledWith({ event: "TRIAL_SIGNUP_HELD", userId: user.id, linkedUserIds: linkedAccounts.map(account => account.id) });
    expect(txService.outsideTransaction).toHaveBeenCalledTimes(1);
    expect(jobQueueService.enqueue).toHaveBeenCalledWith(new ReviewTrialSignup({ userId: user.id, held: true }), {
      singletonKey: reviewHeldTrialSignupKeyFor(fingerprint),
      singletonSeconds: 45 * 60
    });
  });

  it("does not hold a trial while the linked accounts stay below the threshold", async () => {
    const { service, user, jobQueueService, logger } = setup({ mode: "enforce", linkedCount: 1 });

    expect(await service.isHeld(user)).toBe(false);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
  });

  it("follows the configured threshold", async () => {
    const { service, user } = setup({ mode: "enforce", linkedCount: 2, minLinkedAccounts: 3 });

    expect(await service.isHeld(user)).toBe(false);
  });

  it("only logs the hold it would have placed in report mode", async () => {
    const { service, user, linkedAccounts, jobQueueService, logger } = setup({ mode: "report", linkedCount: 2 });

    const held = await service.isHeld(user);

    expect(held).toBe(false);
    expect(logger.info).toHaveBeenCalledWith({
      event: "TRIAL_SIGNUP_HOLD_DRY_RUN",
      userId: user.id,
      linkedUserIds: linkedAccounts.map(account => account.id)
    });
    expect(logger.warn).not.toHaveBeenCalled();
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
  });

  it("looks nothing up when off, without a review window or without a fingerprint", async () => {
    const off = setup({ mode: "off", linkedCount: 2 });
    const noWindow = setup({ mode: "enforce", linkedCount: 2, windowMinutes: undefined });
    const noFingerprint = setup({ mode: "enforce", linkedCount: 2, user: createUser({ lastFingerprint: null }) });

    expect(await off.service.isHeld(off.user)).toBe(false);
    expect(await noWindow.service.isHeld(noWindow.user)).toBe(false);
    expect(await noFingerprint.service.isHeld(noFingerprint.user)).toBe(false);
    expect(off.userRepository.findRecentlyActiveByFingerprint).not.toHaveBeenCalled();
    expect(noWindow.userRepository.findRecentlyActiveByFingerprint).not.toHaveBeenCalled();
    expect(noFingerprint.userRepository.findRecentlyActiveByFingerprint).not.toHaveBeenCalled();
  });

  it("still holds the trial when the report cannot be queued", async () => {
    const { service, user, jobQueueService, logger } = setup({ mode: "enforce", linkedCount: 2 });
    const error = new Error("queue unavailable");
    jobQueueService.enqueue.mockRejectedValue(error);

    const held = await service.isHeld(user);

    expect(held).toBe(true);
    expect(logger.error).toHaveBeenCalledWith({ event: "TRIAL_SIGNUP_HOLD_REPORT_FAILED", userId: user.id, error });
  });

  describe("generated email tag", () => {
    const taggedEmail = "veliarothmann5510+y177lq10ru@hotmail.com";

    it("holds a trial whose email carries a generated tag and reports it once per window when the device has linked accounts", async () => {
      const { service, user, fingerprint, userRepository, jobQueueService, logger } = setup({
        mode: "off",
        linkedCount: 1,
        tagMode: "enforce",
        email: taggedEmail
      });

      const held = await service.isHeld(user);

      expect(held).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith({ event: "TRIAL_SIGNUP_HELD_FOR_GENERATED_EMAIL_TAG", userId: user.id });
      expect(userRepository.findRecentlyActiveByFingerprint).toHaveBeenCalledWith(fingerprint, user.id, 45);
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(new ReviewTrialSignup({ userId: user.id, held: true }), {
        singletonKey: reviewHeldTrialSignupKeyFor(fingerprint),
        singletonSeconds: 45 * 60
      });
    });

    it("still holds the trial when the linked accounts cannot be read for the report", async () => {
      const { service, user, userRepository, jobQueueService, logger } = setup({ mode: "off", tagMode: "enforce", email: taggedEmail });
      const error = new Error("database unavailable");
      userRepository.findRecentlyActiveByFingerprint.mockRejectedValue(error);

      expect(await service.isHeld(user)).toBe(true);
      expect(logger.error).toHaveBeenCalledWith({ event: "TRIAL_SIGNUP_HOLD_REPORT_FAILED", userId: user.id, error });
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("holds without reporting when the device has no linked accounts, so the report slot stays free", async () => {
      const { service, user, jobQueueService } = setup({ tagMode: "enforce", email: taggedEmail });

      expect(await service.isHeld(user)).toBe(true);
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("holds a trial for a generated tag even when the linked accounts stay below the threshold", async () => {
      const { service, user } = setup({ mode: "enforce", linkedCount: 1, tagMode: "enforce", email: taggedEmail });

      expect(await service.isHeld(user)).toBe(true);
    });

    it("places a single hold when both rules apply", async () => {
      const { service, user, logger } = setup({ mode: "enforce", linkedCount: 2, tagMode: "enforce", email: taggedEmail });

      expect(await service.isHeld(user)).toBe(true);
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "TRIAL_SIGNUP_HELD" }));
    });

    it("only logs the hold it would have placed in report mode", async () => {
      const { service, user, jobQueueService, logger } = setup({ tagMode: "report", email: taggedEmail });

      expect(await service.isHeld(user)).toBe(false);
      expect(logger.info).toHaveBeenCalledWith({ event: "TRIAL_SIGNUP_GENERATED_EMAIL_TAG_HOLD_DRY_RUN", userId: user.id });
      expect(logger.warn).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("ignores the tag when off", async () => {
      const { service, user, logger } = setup({ tagMode: "off", email: taggedEmail });

      expect(await service.isHeld(user)).toBe(false);
      expect(logger.info).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("does not hold a trial whose email carries no generated tag", async () => {
      const { service, user, logger } = setup({ tagMode: "enforce", email: "veliarothmann5510+newsletter@hotmail.com" });

      expect(await service.isHeld(user)).toBe(false);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("holds without reporting when there is no fingerprint or review window to throttle the report on", async () => {
      const noFingerprint = setup({ linkedCount: 1, tagMode: "enforce", user: createUser({ email: taggedEmail, lastFingerprint: null }) });
      const noWindow = setup({ linkedCount: 1, tagMode: "enforce", email: taggedEmail, windowMinutes: undefined });

      expect(await noFingerprint.service.isHeld(noFingerprint.user)).toBe(true);
      expect(await noWindow.service.isHeld(noWindow.user)).toBe(true);
      expect(noFingerprint.userRepository.findRecentlyActiveByFingerprint).not.toHaveBeenCalled();
      expect(noWindow.userRepository.findRecentlyActiveByFingerprint).not.toHaveBeenCalled();
      expect(noFingerprint.jobQueueService.enqueue).not.toHaveBeenCalled();
      expect(noWindow.jobQueueService.enqueue).not.toHaveBeenCalled();
    });
  });

  describe("email domain reputation", () => {
    const signals: EmailDomainSignal[] = [{ signal: "mail_server_shared_with_blocked_domain", blockedDomain: "step-sis.help" }];

    it("holds a trial with email domain signals and reports it once per window when the device has linked accounts", async () => {
      const { service, user, fingerprint, emailDomainReputationService, jobQueueService, logger } = setup({
        mode: "off",
        tagMode: "off",
        domainMode: "enforce",
        domainSignals: signals,
        linkedCount: 1
      });

      const held = await service.isHeld(user);

      expect(held).toBe(true);
      expect(emailDomainReputationService.findSignals).toHaveBeenCalledWith(user);
      expect(logger.warn).toHaveBeenCalledWith({ event: "TRIAL_SIGNUP_HELD_FOR_EMAIL_DOMAIN", userId: user.id, domain: DOMAIN, signals });
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(new ReviewTrialSignup({ userId: user.id, held: true }), {
        singletonKey: reviewHeldTrialSignupKeyFor(fingerprint),
        singletonSeconds: 45 * 60
      });
    });

    describe("when the hold ties the domain to an already blocked one", () => {
      it("asks for the domain to be blocked outside the transaction, once per held user", async () => {
        const { service, user, jobQueueService, txService } = setup({ mode: "off", tagMode: "off", domainMode: "enforce", domainSignals: signals });

        expect(await service.isHeld(user)).toBe(true);
        expect(txService.outsideTransaction).toHaveBeenCalled();
        expect(jobQueueService.enqueue).toHaveBeenCalledWith(
          new BlockEmailDomainOfHeldSignup({ userId: user.id, emailDomain: DOMAIN, evidence: signals[0] as HeldSignupBlockEvidence }),
          {
            singletonKey: blockEmailDomainOfHeldSignupKeyFor(user.id)
          }
        );
      });

      it("passes the first signal naming a blocked domain as the evidence", async () => {
        const device: EmailDomainSignal = { signal: "device_shared_with_blocked_domain", linkedUserId: faker.string.uuid(), blockedDomain: "afronewz.com" };
        const { service, user, jobQueueService } = setup({
          mode: "off",
          tagMode: "off",
          domainMode: "enforce",
          domainSignals: [{ signal: "signup_burst", burstDomain: DOMAIN, signups: 7 }, device, ...signals]
        });

        await service.isHeld(user);

        expect(jobQueueService.enqueue).toHaveBeenCalledWith(
          new BlockEmailDomainOfHeldSignup({ userId: user.id, emailDomain: DOMAIN, evidence: device as HeldSignupBlockEvidence }),
          {
            singletonKey: blockEmailDomainOfHeldSignupKeyFor(user.id)
          }
        );
      });

      it("asks for no block when the held address has no domain to block", async () => {
        const device: EmailDomainSignal = { signal: "device_shared_with_blocked_domain", linkedUserId: faker.string.uuid(), blockedDomain: "afronewz.com" };
        const { service, user, jobQueueService } = setup({ mode: "off", tagMode: "off", domainMode: "enforce", domainSignals: [device], assessedDomain: null });

        expect(await service.isHeld(user)).toBe(true);
        expect(jobQueueService.enqueue).not.toHaveBeenCalled();
      });

      it("asks for no block when the held sign-up block is switched off", async () => {
        const { service, user, jobQueueService } = setup({ mode: "off", tagMode: "off", domainMode: "enforce", domainSignals: signals, blockMode: "off" });

        expect(await service.isHeld(user)).toBe(true);
        expect(jobQueueService.enqueue).not.toHaveBeenCalled();
      });

      it("still holds the trial and logs the failure when the block cannot be queued", async () => {
        const { service, user, jobQueueService, logger } = setup({ mode: "off", tagMode: "off", domainMode: "enforce", domainSignals: signals });
        const error = new Error("queue unavailable");
        jobQueueService.enqueue.mockRejectedValue(error);

        expect(await service.isHeld(user)).toBe(true);
        expect(logger.error).toHaveBeenCalledWith({ event: "TRIAL_SIGNUP_DOMAIN_BLOCK_REQUEST_FAILED", userId: user.id, error });
      });
    });

    it("holds without asking for a block when only a burst or forwarding-only mail ties the domain to abuse", async () => {
      const { service, user, jobQueueService } = setup({
        mode: "off",
        tagMode: "off",
        domainMode: "enforce",
        domainSignals: [{ signal: "signup_burst", burstDomain: DOMAIN, signups: 5 }, { signal: "forwarding_only_without_website" }]
      });

      expect(await service.isHeld(user)).toBe(true);
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("only logs the hold it would have placed in report mode", async () => {
      const { service, user, jobQueueService, logger } = setup({ mode: "off", tagMode: "off", domainMode: "report", domainSignals: signals });

      expect(await service.isHeld(user)).toBe(false);
      expect(logger.info).toHaveBeenCalledWith({ event: "TRIAL_SIGNUP_EMAIL_DOMAIN_HOLD_DRY_RUN", userId: user.id, domain: DOMAIN, signals });
      expect(logger.warn).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("does not hold a trial without email domain signals", async () => {
      const { service, user, logger } = setup({ mode: "off", tagMode: "off", domainMode: "enforce", domainSignals: [] });

      expect(await service.isHeld(user)).toBe(false);
      expect(logger.info).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("assesses nothing when off", async () => {
      const { service, user, emailDomainReputationService } = setup({ mode: "off", tagMode: "off", domainMode: "off", domainSignals: signals });

      expect(await service.isHeld(user)).toBe(false);
      expect(emailDomainReputationService.findSignals).not.toHaveBeenCalled();
    });

    it("grants the trial and logs the failure when the assessment fails", async () => {
      const { service, user, emailDomainReputationService, logger } = setup({ mode: "off", tagMode: "off", domainMode: "enforce" });
      const error = new Error("database unavailable");
      emailDomainReputationService.findSignals.mockRejectedValue(error);

      expect(await service.isHeld(user)).toBe(false);
      expect(logger.error).toHaveBeenCalledWith({ event: "TRIAL_SIGNUP_EMAIL_DOMAIN_CHECK_FAILED", userId: user.id, error });
    });

    it("skips the assessment once an earlier rule holds the trial", async () => {
      const { service, user, emailDomainReputationService } = setup({
        tagMode: "enforce",
        email: "veliarothmann5510+y177lq10ru@hotmail.com",
        domainMode: "enforce"
      });

      expect(await service.isHeld(user)).toBe(true);
      expect(emailDomainReputationService.findSignals).not.toHaveBeenCalled();
    });
  });

  describe("refused sign-up", () => {
    const otherRulesOff = { mode: "off", tagMode: "off", domainMode: "off" } as const;

    it("holds a trial asked for from a browser refused at sign-up and queues one review per account and window, outside the transaction", async () => {
      const { service, user, refusedSignupService, jobQueueService, txService, logger } = setup({
        ...otherRulesOff,
        refusedSignupMode: "enforce",
        wasRecentlyRefused: true,
        refusedSignupWindowMinutes: 30
      });

      expect(await service.isHeld(user)).toBe(true);
      expect(refusedSignupService.wasRecentlyRefused).toHaveBeenCalledWith({ ip: user.lastIp, userAgent: user.lastUserAgent });
      expect(logger.warn).toHaveBeenCalledWith({ event: "TRIAL_SIGNUP_HELD_FOR_REFUSED_SIGNUP", userId: user.id });
      expect(txService.outsideTransaction).toHaveBeenCalledTimes(1);
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(new ReviewTrialAfterRefusedSignup({ userId: user.id, windowMinutes: 30 }), {
        singletonKey: reviewTrialAfterRefusedSignupKeyFor(user.id),
        singletonSeconds: 30 * 60
      });
    });

    it("only logs the hold it would have placed in report mode", async () => {
      const { service, user, jobQueueService, logger } = setup({ ...otherRulesOff, refusedSignupMode: "report", wasRecentlyRefused: true });

      expect(await service.isHeld(user)).toBe(false);
      expect(logger.info).toHaveBeenCalledWith({ event: "TRIAL_SIGNUP_REFUSED_SIGNUP_HOLD_DRY_RUN", userId: user.id });
      expect(logger.warn).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("does not hold a trial asked for from a browser that was not refused", async () => {
      const { service, user, jobQueueService, logger } = setup({ ...otherRulesOff, refusedSignupMode: "enforce", wasRecentlyRefused: false });

      expect(await service.isHeld(user)).toBe(false);
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("looks nothing up when off", async () => {
      const { service, user, refusedSignupService } = setup({ ...otherRulesOff, refusedSignupMode: "off", wasRecentlyRefused: true });

      expect(await service.isHeld(user)).toBe(false);
      expect(refusedSignupService.wasRecentlyRefused).not.toHaveBeenCalled();
    });

    it("grants the trial and logs the failure when the lookup fails", async () => {
      const { service, user, refusedSignupService, logger } = setup({ ...otherRulesOff, refusedSignupMode: "enforce" });
      const error = new Error("database unavailable");
      refusedSignupService.wasRecentlyRefused.mockRejectedValue(error);

      expect(await service.isHeld(user)).toBe(false);
      expect(logger.error).toHaveBeenCalledWith({ event: "TRIAL_SIGNUP_REFUSED_SIGNUP_CHECK_FAILED", userId: user.id, error });
    });

    it("still holds the trial and logs the failure when the review cannot be queued", async () => {
      const { service, user, jobQueueService, logger } = setup({ ...otherRulesOff, refusedSignupMode: "enforce", wasRecentlyRefused: true });
      const error = new Error("queue unavailable");
      jobQueueService.enqueue.mockRejectedValue(error);

      expect(await service.isHeld(user)).toBe(true);
      expect(logger.error).toHaveBeenCalledWith({ event: "TRIAL_SIGNUP_HOLD_REPORT_FAILED", userId: user.id, error });
    });

    it("skips the email domain signals once the refused sign-up holds the trial", async () => {
      const { service, user, emailDomainReputationService } = setup({
        mode: "off",
        tagMode: "off",
        domainMode: "enforce",
        refusedSignupMode: "enforce",
        wasRecentlyRefused: true
      });

      expect(await service.isHeld(user)).toBe(true);
      expect(emailDomainReputationService.findSignals).not.toHaveBeenCalled();
    });
  });

  describe("new email domain", () => {
    const burst: SignupBurst = { burstDomain: "duskvale.xyz", signups: 2 };
    const otherRulesOff = { mode: "off", tagMode: "off", domainMode: "off" } as const;

    it("holds a further sign-up from a new domain and queues one review per domain and window, outside the transaction", async () => {
      const { service, user, emailDomainReputationService, jobQueueService, txService, logger } = setup({
        ...otherRulesOff,
        newDomainMode: "enforce",
        newDomainBurst: burst,
        newDomainMinSignups: 3,
        newDomainWindowHours: 6
      });

      expect(await service.isHeld(user)).toBe(true);
      expect(emailDomainReputationService.findSignupBurst).toHaveBeenCalledWith(user, { minSignups: 3, windowHours: 6 });
      expect(logger.warn).toHaveBeenCalledWith({ event: "TRIAL_SIGNUP_HELD_FOR_NEW_EMAIL_DOMAIN", userId: user.id, domain: "duskvale.xyz", signups: 2 });
      expect(txService.outsideTransaction).toHaveBeenCalledTimes(1);
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(new ReviewNewEmailDomainSignups({ userId: user.id, domain: "duskvale.xyz", windowHours: 6 }), {
        singletonKey: reviewNewEmailDomainSignupsKeyFor("duskvale.xyz"),
        singletonSeconds: 6 * 60 * 60
      });
    });

    it("only logs the hold it would have placed in report mode", async () => {
      const { service, user, jobQueueService, logger } = setup({ ...otherRulesOff, newDomainMode: "report", newDomainBurst: burst });

      expect(await service.isHeld(user)).toBe(false);
      expect(logger.info).toHaveBeenCalledWith({ event: "TRIAL_SIGNUP_NEW_EMAIL_DOMAIN_HOLD_DRY_RUN", userId: user.id, domain: "duskvale.xyz", signups: 2 });
      expect(logger.warn).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("does not hold a sign-up whose domain shows no burst", async () => {
      const { service, user, jobQueueService, logger } = setup({ ...otherRulesOff, newDomainMode: "enforce", newDomainBurst: null });

      expect(await service.isHeld(user)).toBe(false);
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("counts nothing when off", async () => {
      const { service, user, emailDomainReputationService } = setup({ ...otherRulesOff, newDomainMode: "off", newDomainBurst: burst });

      expect(await service.isHeld(user)).toBe(false);
      expect(emailDomainReputationService.findSignupBurst).not.toHaveBeenCalled();
    });

    it("grants the trial and logs the failure when the count fails", async () => {
      const { service, user, emailDomainReputationService, logger } = setup({ ...otherRulesOff, newDomainMode: "enforce" });
      const error = new Error("database unavailable");
      emailDomainReputationService.findSignupBurst.mockRejectedValue(error);

      expect(await service.isHeld(user)).toBe(false);
      expect(logger.error).toHaveBeenCalledWith({ event: "TRIAL_SIGNUP_NEW_EMAIL_DOMAIN_CHECK_FAILED", userId: user.id, error });
    });

    it("still holds the trial and logs the failure when the review cannot be queued", async () => {
      const { service, user, jobQueueService, logger } = setup({ ...otherRulesOff, newDomainMode: "enforce", newDomainBurst: burst });
      const error = new Error("queue unavailable");
      jobQueueService.enqueue.mockRejectedValue(error);

      expect(await service.isHeld(user)).toBe(true);
      expect(logger.error).toHaveBeenCalledWith({ event: "TRIAL_SIGNUP_HOLD_REPORT_FAILED", userId: user.id, error });
    });

    it("skips the count once the email domain signals hold the trial", async () => {
      const { service, user, emailDomainReputationService } = setup({
        mode: "off",
        tagMode: "off",
        domainMode: "enforce",
        domainSignals: [{ signal: "forwarding_only_without_website" }],
        newDomainMode: "enforce",
        newDomainBurst: burst
      });

      expect(await service.isHeld(user)).toBe(true);
      expect(emailDomainReputationService.findSignupBurst).not.toHaveBeenCalled();
    });
  });

  function setup(
    input: {
      mode?: "off" | "report" | "enforce";
      tagMode?: "off" | "report" | "enforce";
      domainMode?: "off" | "report" | "enforce";
      blockMode?: "off" | "report" | "enforce";
      newDomainMode?: "off" | "report" | "enforce";
      refusedSignupMode?: "off" | "report" | "enforce";
      wasRecentlyRefused?: boolean;
      refusedSignupWindowMinutes?: number;
      newDomainBurst?: SignupBurst | null;
      newDomainMinSignups?: number;
      newDomainWindowHours?: number;
      domainSignals?: EmailDomainSignal[];
      assessedDomain?: string | null;
      linkedCount?: number;
      minLinkedAccounts?: number;
      windowMinutes?: number;
      email?: string;
      user?: UserOutput;
    } = {}
  ) {
    const fingerprint = faker.string.hexadecimal({ length: 64 });
    const user = input.user ?? createUser({ lastFingerprint: fingerprint, ...(input.email && { email: input.email }) });
    const linkedAccounts = Array.from({ length: input.linkedCount ?? 0 }, () => ({ id: faker.string.uuid(), email: faker.internet.email() }));
    const userRepository = mock<UserRepository>({ findRecentlyActiveByFingerprint: vi.fn().mockResolvedValue(linkedAccounts) });
    const jobQueueService = mock<JobQueueService>({ enqueue: vi.fn().mockResolvedValue("job-id") });
    const txService = mock<TxService>({ outsideTransaction: vi.fn(async cb => await cb()) });
    const config = mockConfig<WorkloadAbuseConfigService>({
      WORKLOAD_ABUSE_SIGNUP_HOLD_MODE: input.mode ?? "report",
      WORKLOAD_ABUSE_SIGNUP_HOLD_MIN_LINKED_ACCOUNTS: input.minLinkedAccounts ?? 2,
      WORKLOAD_ABUSE_GENERATED_EMAIL_TAG_HOLD_MODE: input.tagMode ?? "report",
      WORKLOAD_ABUSE_EMAIL_DOMAIN_HOLD_MODE: input.domainMode ?? "report",
      WORKLOAD_ABUSE_HELD_SIGNUP_DOMAIN_BLOCK_MODE: input.blockMode ?? "report",
      WORKLOAD_ABUSE_NEW_EMAIL_DOMAIN_HOLD_MODE: input.newDomainMode ?? "off",
      WORKLOAD_ABUSE_REFUSED_SIGNUP_HOLD_MODE: input.refusedSignupMode ?? "off",
      WORKLOAD_ABUSE_REFUSED_SIGNUP_HOLD_WINDOW_MINUTES: input.refusedSignupWindowMinutes ?? 60,
      WORKLOAD_ABUSE_NEW_EMAIL_DOMAIN_MIN_SIGNUPS: input.newDomainMinSignups ?? 2,
      WORKLOAD_ABUSE_NEW_EMAIL_DOMAIN_WINDOW_HOURS: input.newDomainWindowHours ?? 24,
      WORKLOAD_ABUSE_SIGNUP_REVIEW_WINDOW_MINUTES: "windowMinutes" in input ? input.windowMinutes : 45
    });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const emailDomainReputationService = mock<EmailDomainReputationService>({
      findSignals: vi.fn().mockResolvedValue({ domain: "assessedDomain" in input ? input.assessedDomain : DOMAIN, signals: input.domainSignals ?? [] }),
      findSignupBurst: vi.fn().mockResolvedValue(input.newDomainBurst ?? null)
    });
    const refusedSignupService = mock<RefusedSignupService>({ wasRecentlyRefused: vi.fn().mockResolvedValue(input.wasRecentlyRefused ?? false) });
    const service = new TrialSignupHoldService(
      userRepository,
      jobQueueService,
      txService,
      config,
      emailDomainReputationService,
      refusedSignupService,
      createLogger
    );

    return {
      service,
      user,
      fingerprint,
      linkedAccounts,
      userRepository,
      jobQueueService,
      txService,
      logger,
      createLogger,
      emailDomainReputationService,
      refusedSignupService
    };
  }
});
