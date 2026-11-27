import { subMinutes } from "date-fns";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core/providers/logging.provider";
import { hashBrowser } from "@src/workload-abuse/lib/account-hashes/account-hashes";
import type { RefusedSignupRepository } from "@src/workload-abuse/repositories/refused-signup/refused-signup.repository";
import type { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import { RefusedSignupService } from "./refused-signup.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

const SECRET = "a".repeat(32);
const NOW = new Date("2026-11-26T12:00:00.000Z");
const BROWSER = { ip: "203.0.113.7", userAgent: "Mozilla/5.0 Chrome/142.0" };

describe(RefusedSignupService.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("remember", () => {
    it("records the keyed hash of the browser after dropping the records that left the window", async () => {
      const { service, repository, logger } = setup({ windowMinutes: 30 });

      await service.remember(BROWSER);

      expect(repository.deleteOlderThan).toHaveBeenCalledWith(subMinutes(NOW, 30));
      expect(repository.create).toHaveBeenCalledWith({ browserHash: hashBrowser(SECRET, BROWSER) });
      expect(repository.deleteOlderThan.mock.invocationCallOrder[0]).toBeLessThan(repository.create.mock.invocationCallOrder[0]);
      expect(logger.info).toHaveBeenCalledWith({ event: "REFUSED_SIGNUP_REMEMBERED" });
    });

    it("records in report mode too, so its dry run has refusals to match", async () => {
      const { service, repository } = setup({ mode: "report" });

      await service.remember(BROWSER);

      expect(repository.create).toHaveBeenCalledTimes(1);
    });

    it("records nothing while the rule is off", async () => {
      const { service, repository } = setup({ mode: "off" });

      await service.remember(BROWSER);

      expect(repository.deleteOlderThan).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("records nothing for a request without an address or a user agent", async () => {
      const { service, repository } = setup();

      await service.remember({ ip: undefined, userAgent: BROWSER.userAgent });
      await service.remember({ ip: BROWSER.ip, userAgent: undefined });

      expect(repository.deleteOlderThan).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("logs a record that could not be written instead of failing the refusal", async () => {
      const { service, repository, logger } = setup();
      const error = new Error("database unavailable");
      repository.create.mockRejectedValue(error);

      await expect(service.remember(BROWSER)).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith({ event: "REFUSED_SIGNUP_NOT_REMEMBERED", error });
      expect(logger.info).not.toHaveBeenCalled();
    });
  });

  describe("wasRecentlyRefused", () => {
    it("asks for a refusal of the same browser inside the window", async () => {
      const { service, repository } = setup({ windowMinutes: 30, isOnRecord: true });

      await expect(service.wasRecentlyRefused(BROWSER)).resolves.toBe(true);

      expect(repository.existsSince).toHaveBeenCalledWith(hashBrowser(SECRET, BROWSER), subMinutes(NOW, 30));
    });

    it("answers no when no refusal is on record", async () => {
      const { service } = setup({ isOnRecord: false });

      await expect(service.wasRecentlyRefused(BROWSER)).resolves.toBe(false);
    });

    it("answers no without reading for an account that has no address or user agent on record", async () => {
      const { service, repository } = setup({ isOnRecord: true });

      await expect(service.wasRecentlyRefused({ ip: null, userAgent: BROWSER.userAgent })).resolves.toBe(false);
      await expect(service.wasRecentlyRefused({ ip: BROWSER.ip, userAgent: null })).resolves.toBe(false);

      expect(repository.existsSince).not.toHaveBeenCalled();
    });
  });

  it("creates the logger with the service context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: RefusedSignupService.name });
  });

  function setup(input: { mode?: "off" | "report" | "enforce"; windowMinutes?: number; isOnRecord?: boolean } = {}) {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });

    const repository = mock<RefusedSignupRepository>();
    repository.existsSince.mockResolvedValue(input.isOnRecord ?? false);
    const config = mockConfigService<WorkloadAbuseConfigService>({
      WORKLOAD_ABUSE_ACCOUNT_HASH_SECRET: SECRET,
      WORKLOAD_ABUSE_REFUSED_SIGNUP_HOLD_MODE: input.mode ?? "enforce",
      WORKLOAD_ABUSE_REFUSED_SIGNUP_HOLD_WINDOW_MINUTES: input.windowMinutes ?? 60
    });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const service = new RefusedSignupService(repository, config, createLogger);

    return { service, repository, logger, createLogger };
  }
});
