import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { FundingFreeze } from "@src/model-schemas";
import type { FundingControlsDatabase } from "@src/providers/funding-controls-database.provider";
import type { LoggerService } from "@src/providers/logging.provider";
import type { FundingFreezeRepository } from "@src/repositories/funding-freeze/funding-freeze.repository";
import { FundingFreezeService } from "./funding-freeze.service";

const FROZEN_MESSAGE = "Funding is frozen, so no grant, transfer or deposit from a funding wallet is signed";
const UNREADABLE_MESSAGE = "The funding freeze could not be read, so no grant, transfer or deposit from a funding wallet is signed";

describe(FundingFreezeService.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("load", () => {
    it("reads nothing for a signer given no database, and says the freeze is off", async () => {
      const { service, repository, logger } = setup({ isConfigured: false });

      await service.load();

      expect(repository.findActive).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledExactlyOnceWith({ event: "FUNDING_FREEZE_OFF" });
    });

    it("reports a signer that starts with funding open", async () => {
      const { service, logger } = setup({});

      await service.load();

      expect(logger.info).toHaveBeenCalledExactlyOnceWith({ event: "FUNDING_FREEZE_LOADED", isFrozen: false });
    });

    it("reports a signer that starts frozen", async () => {
      const { service, logger } = setup({ freeze: createFreeze() });

      await service.load();

      expect(logger.info).toHaveBeenCalledExactlyOnceWith({ event: "FUNDING_FREEZE_LOADED", isFrozen: true });
    });

    it("fails for a database it cannot read, so the signer does not start", async () => {
      const { service, repository } = setup({});
      repository.findActive.mockRejectedValue(new Error("connection refused"));

      await expect(service.load()).rejects.toThrow("connection refused");
    });
  });

  describe("assertFundingIsNotFrozen", () => {
    it("lets everything through for a signer given no database", async () => {
      const { service, repository } = setup({ isConfigured: false });

      await expect(service.assertFundingIsNotFrozen()).resolves.toBeUndefined();
      expect(repository.findActive).not.toHaveBeenCalled();
    });

    it("lets a request through while no freeze stands", async () => {
      const { service, logger } = setup({});

      await expect(service.assertFundingIsNotFrozen()).resolves.toBeUndefined();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("refuses a request while a freeze stands, logging who froze and why without telling the caller", async () => {
      const freeze = createFreeze({ reason: "funding key suspected leaked", frozenBy: "on-call" });
      const { service, logger } = setup({ freeze });

      const refusal = await service.assertFundingIsNotFrozen().catch(error => error);

      expect(refusal).toMatchObject({ status: 503, message: FROZEN_MESSAGE });
      expect(logger.warn).toHaveBeenCalledExactlyOnceWith({
        event: "FUNDING_FROZEN_REQUEST_REFUSED",
        reason: "funding key suspected leaked",
        frozenBy: "on-call",
        frozenAt: freeze.frozenAt
      });
    });

    it("reads the freeze on every request, so one set between two requests stops the second", async () => {
      const { service, repository } = setup({});

      await service.assertFundingIsNotFrozen();
      repository.findActive.mockResolvedValue(createFreeze());

      await expect(service.assertFundingIsNotFrozen()).rejects.toThrow(FROZEN_MESSAGE);
    });

    it("lets a request through again once the freeze is lifted", async () => {
      const { service, repository } = setup({ freeze: createFreeze() });

      await expect(service.assertFundingIsNotFrozen()).rejects.toThrow(FROZEN_MESSAGE);
      repository.findActive.mockResolvedValue(undefined);

      await expect(service.assertFundingIsNotFrozen()).resolves.toBeUndefined();
    });

    it("lets a request through on the last read when a read fails within a minute of it", async () => {
      const { service, repository, logger } = setup({ now: "2026-11-28T10:00:00.000Z" });
      await service.load();
      const failure = new Error("connection reset");
      repository.findActive.mockRejectedValue(failure);

      vi.setSystemTime("2026-11-28T10:01:00.000Z");

      await expect(service.assertFundingIsNotFrozen()).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalledExactlyOnceWith({ event: "FUNDING_FREEZE_UNREADABLE", isLastReadTrusted: true, error: failure });
    });

    it("keeps refusing on the last read when a read fails while a freeze stood", async () => {
      const { service, repository } = setup({ freeze: createFreeze(), now: "2026-11-28T10:00:00.000Z" });
      await service.load();
      repository.findActive.mockRejectedValue(new Error("connection reset"));

      await expect(service.assertFundingIsNotFrozen()).rejects.toThrow(FROZEN_MESSAGE);
    });

    it("refuses a request once the last read is more than a minute old, since a freeze may have been set since", async () => {
      const { service, repository, logger } = setup({ now: "2026-11-28T10:00:00.000Z" });
      await service.load();
      const failure = new Error("connection reset");
      repository.findActive.mockRejectedValue(failure);

      vi.setSystemTime("2026-11-28T10:01:00.001Z");
      const refusal = await service.assertFundingIsNotFrozen().catch(error => error);

      expect(refusal).toMatchObject({ status: 503, message: UNREADABLE_MESSAGE, cause: failure });
      expect(logger.error).toHaveBeenCalledExactlyOnceWith({ event: "FUNDING_FREEZE_UNREADABLE", isLastReadTrusted: false, error: failure });
    });

    it("refuses a request when the freeze was never read", async () => {
      const { service, repository } = setup({});
      repository.findActive.mockRejectedValue(new Error("connection reset"));

      await expect(service.assertFundingIsNotFrozen()).rejects.toThrow(UNREADABLE_MESSAGE);
    });

    it("goes by the freeze a later read saw when an earlier read, begun before the freeze, answers after it", async () => {
      const { service, repository } = setup({});
      let answerEarlierRead!: (freeze: FundingFreeze | undefined) => void;
      repository.findActive.mockReturnValueOnce(
        new Promise(resolve => {
          answerEarlierRead = resolve;
        })
      );
      const earlierRequest = service.assertFundingIsNotFrozen();
      repository.findActive.mockResolvedValueOnce(createFreeze());
      await expect(service.assertFundingIsNotFrozen()).rejects.toThrow(FROZEN_MESSAGE);

      answerEarlierRead(undefined);
      await earlierRequest;
      repository.findActive.mockRejectedValue(new Error("connection reset"));

      await expect(service.assertFundingIsNotFrozen()).rejects.toThrow(FROZEN_MESSAGE);
    });

    it("counts the minute from the latest read that worked", async () => {
      const { service, repository } = setup({ now: "2026-11-28T10:00:00.000Z" });
      await service.load();
      vi.setSystemTime("2026-11-28T10:00:50.000Z");
      await service.assertFundingIsNotFrozen();
      repository.findActive.mockRejectedValue(new Error("connection reset"));

      vi.setSystemTime("2026-11-28T10:01:30.000Z");

      await expect(service.assertFundingIsNotFrozen()).resolves.toBeUndefined();
    });
  });

  function createFreeze(overrides: Partial<FundingFreeze> = {}): FundingFreeze {
    return {
      id: "7c0f3f0e-5a3b-4a53-9a0c-6f6f3a2f8f11",
      reason: "drill",
      frozenBy: "operator",
      frozenAt: new Date("2026-11-28T09:00:00.000Z"),
      liftedBy: null,
      liftedAt: null,
      ...overrides
    };
  }

  function setup(input: { isConfigured?: boolean; freeze?: FundingFreeze; now?: string }) {
    vi.useFakeTimers({ toFake: ["Date"] });
    if (input.now) vi.setSystemTime(input.now);

    const database = mock<FundingControlsDatabase>({ isConfigured: input.isConfigured ?? true });
    const repository = mock<FundingFreezeRepository>();
    repository.findActive.mockResolvedValue(input.freeze);
    const logger = mock<LoggerService>();
    const service = new FundingFreezeService(database, repository, logger);

    return { service, repository, logger };
  }
});
