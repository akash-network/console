import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { GpuWaitlistConfig } from "@src/gpu-waitlist/providers/config.provider";
import type { GpuWaitlistEntryRow } from "@src/gpu-waitlist/repositories/gpu-waitlist-entry/gpu-waitlist-entry.repository";
import type {
  HardwareRequestAccountService,
  HardwareRequestAccountType
} from "@src/hardware-request/services/hardware-request-account/hardware-request-account.service";
import { GpuWaitlistEligibilityService } from "./gpu-waitlist-eligibility.service";

const HOUR_MS = 60 * 60 * 1000;
const NOW = new Date("2026-11-18T12:00:00.000Z");

describe(GpuWaitlistEligibilityService.name, () => {
  describe("isWithinEmailLimits", () => {
    it("allows an entry never emailed", () => {
      const { service } = setup();

      expect(service.isWithinEmailLimits(entry("a"), undefined, NOW)).toBe(true);
    });

    it("refuses an entry already emailed in the open episode", () => {
      const { service } = setup();
      const episode = { waveStartedAt: hoursAgo(1) };

      expect(service.isWithinEmailLimits(entry("a", { lastNotifiedAt: hoursAgo(1), notifiedCount: 1 }), episode, NOW)).toBe(false);
      expect(service.isWithinEmailLimits(entry("b", { lastNotifiedAt: hoursAgo(2), notifiedCount: 1 }), episode, NOW)).toBe(true);
    });

    it("refuses an entry at its daily email cap and allows it again a day after its last email", () => {
      const { service } = setup();

      expect(service.isWithinEmailLimits(entry("a", { lastNotifiedAt: hoursAgo(23), notifiedCount: 2 }), undefined, NOW)).toBe(false);
      expect(service.isWithinEmailLimits(entry("b", { lastNotifiedAt: hoursAgo(23), notifiedCount: 1 }), undefined, NOW)).toBe(true);
      expect(service.isWithinEmailLimits(entry("c", { lastNotifiedAt: hoursAgo(24), notifiedCount: 2 }), undefined, NOW)).toBe(true);
    });
  });

  describe("findFirstEligible", () => {
    it("returns the first entry in line that is within its limits and not trialing", async () => {
      const { service } = setup({ accountTypes: { trial: "trial" } });
      const entries = [entry("capped", { lastNotifiedAt: hoursAgo(1), notifiedCount: 2 }), entry("trial"), entry("a"), entry("b")];

      expect(await service.findFirstEligible(entries, undefined, NOW)).toBe(entries[2]);
    });

    it("reads no account for an entry over its email limits and none past the first eligible one", async () => {
      const { service, accountService } = setup();
      const entries = [entry("capped", { lastNotifiedAt: hoursAgo(1), notifiedCount: 2 }), entry("a"), entry("b")];

      await service.findFirstEligible(entries, undefined, NOW);

      expect(accountService.findAccountType.mock.calls.map(([owner]) => owner.userId)).toEqual(["user-a"]);
    });

    it("returns nothing when only trial users are within their limits", async () => {
      const { service } = setup({ accountTypes: { trial: "trial" } });

      expect(await service.findFirstEligible([entry("trial")], undefined, NOW)).toBeUndefined();
    });

    it("reads an account once across calls that share answers, and apart for another organization", async () => {
      const { service, accountService } = setup({ accountTypes: { a: "trial" } });
      const answers = new Map();

      await service.findFirstEligible([entry("a")], undefined, NOW, answers);
      await service.findFirstEligible([entry("a"), entry("a", { organizationId: "org-1" })], undefined, NOW, answers);

      expect(accountService.findAccountType.mock.calls.map(([owner]) => owner)).toEqual([
        { userId: "user-a", organizationId: null },
        { userId: "user-a", organizationId: "org-1" }
      ]);
    });

    it("reads the account of the entry's organization", async () => {
      const { service, accountService } = setup();

      await service.findFirstEligible([entry("a", { organizationId: "org-1" })], undefined, NOW);

      expect(accountService.findAccountType).toHaveBeenCalledWith({ userId: "user-a", organizationId: "org-1" });
    });
  });

  function entry(id: string, overrides: Partial<GpuWaitlistEntryRow> = {}) {
    return mock<GpuWaitlistEntryRow>({ id, userId: `user-${id}`, organizationId: null, lastNotifiedAt: null, notifiedCount: 0, ...overrides });
  }

  function hoursAgo(hours: number) {
    return new Date(NOW.getTime() - hours * HOUR_MS);
  }

  function setup(input: { accountTypes?: Record<string, HardwareRequestAccountType> } = {}) {
    const accountService = mock<HardwareRequestAccountService>({
      findAccountType: vi.fn(async ({ userId }) => input.accountTypes?.[userId!.replace("user-", "")] ?? "paying")
    });
    const config = mock<GpuWaitlistConfig>({ GPU_WAITLIST_MAX_EMAILS_PER_ENTRY_PER_DAY: 2 });

    return { service: new GpuWaitlistEligibilityService(accountService, config), accountService };
  }
});
