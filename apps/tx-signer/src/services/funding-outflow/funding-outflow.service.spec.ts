import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { TxOutcomeUnknownError } from "@src/lib/signing-client/tx-outcome.error";
import type { FundingOutflowLimit } from "@src/model-schemas";
import type { FundingControlsDatabase } from "@src/providers/funding-controls-database.provider";
import type { LoggerService } from "@src/providers/logging.provider";
import type { FundingOutflowRepository, OutflowUsage } from "@src/repositories/funding-outflow/funding-outflow.repository";
import { FundingOutflowService } from "./funding-outflow.service";

const WALLET = "akash1depositor";
const LANDED_TX = { code: 0, hash: "LANDED" };
const OVER_LIMIT_MESSAGE = "This deposit would take more out of the funding wallets than may leave them in 24 hours";
const UNCOUNTED_MESSAGE = "What leaves the funding wallets could not be counted against its limits, so no deposit from a funding wallet is signed";

describe(FundingOutflowService.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("load", () => {
    it("reads nothing for a signer given no database", async () => {
      const { service, repository, logger } = setup({ isConfigured: false });

      await service.load();

      expect(repository.findLimits).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
    });

    it("reports how many limits it starts with and how many of them are enforced", async () => {
      const { service, logger } = setup({ limits: [createLimit({ isEnforced: true }), createLimit({ scope: "wallet" })] });

      await service.load();

      expect(logger.info).toHaveBeenCalledExactlyOnceWith({ event: "FUNDING_OUTFLOW_LIMITS_LOADED", limits: 2, enforced: 1 });
    });

    it("fails for limits it cannot read, so the signer does not start", async () => {
      const { service, repository } = setup({});
      repository.findLimits.mockRejectedValue(new Error("connection refused"));

      await expect(service.load()).rejects.toThrow("connection refused");
    });
  });

  describe("track", () => {
    it("signs without counting for a signer given no database", async () => {
      const { service, repository, signAndBroadcast } = setup({ isConfigured: false });

      await expect(service.track(WALLET, [uact("5")], signAndBroadcast)).resolves.toBe(LANDED_TX);
      expect(repository.reserve).not.toHaveBeenCalled();
    });

    it("signs without counting a transaction that deposits nothing", async () => {
      const { service, repository, signAndBroadcast } = setup({});

      await expect(service.track(WALLET, [], signAndBroadcast)).resolves.toBe(LANDED_TX);
      expect(repository.findLimits).not.toHaveBeenCalled();
      expect(repository.reserve).not.toHaveBeenCalled();
    });

    it("counts what each denom's deposits add up to before signing, then records the transaction that landed", async () => {
      const { service, repository, signAndBroadcast } = setup({});

      const tx = await service.track(WALLET, [uact("5"), { denom: "uakt", amount: "7" }, uact("11")], signAndBroadcast);

      expect(tx).toBe(LANDED_TX);
      expect(repository.reserve).toHaveBeenCalledExactlyOnceWith(
        WALLET,
        new Map([
          ["uact", 16n],
          ["uakt", 7n]
        ])
      );
      expect(repository.sumSince).toHaveBeenCalledExactlyOnceWith({ windowHours: 24, denoms: ["uact", "uakt"], walletAddress: WALLET });
      expect(repository.reserve.mock.invocationCallOrder[0]).toBeLessThan(signAndBroadcast.mock.invocationCallOrder[0]);
      expect(repository.settle).toHaveBeenCalledExactlyOnceWith(["reservation-1"], "landed", "LANDED");
    });

    it("takes the deposit back for a transaction the chain included but failed", async () => {
      const { service, repository, signAndBroadcast } = setup({});
      signAndBroadcast.mockResolvedValue({ code: 11, hash: "FAILED" });

      await service.track(WALLET, [uact("5")], signAndBroadcast);

      expect(repository.settle).toHaveBeenCalledExactlyOnceWith(["reservation-1"], "released", "FAILED");
    });

    it("takes the deposit back for a transaction that was never included, and passes the failure on", async () => {
      const { service, repository, signAndBroadcast } = setup({});
      const failure = new Error("simulation failed");
      signAndBroadcast.mockRejectedValue(failure);

      await expect(service.track(WALLET, [uact("5")], signAndBroadcast)).rejects.toBe(failure);
      expect(repository.settle).toHaveBeenCalledExactlyOnceWith(["reservation-1"], "released", undefined);
    });

    it("keeps counting the deposit of a transaction whose outcome is undecided, since it may still land", async () => {
      const { service, repository, signAndBroadcast } = setup({});
      const undecided = new TxOutcomeUnknownError("PENDING");
      signAndBroadcast.mockRejectedValue(undecided);

      await expect(service.track(WALLET, [uact("5")], signAndBroadcast)).rejects.toBe(undecided);
      expect(repository.settle).not.toHaveBeenCalled();
    });

    it.each(["1.5", "-1", "", "1e6", " 5"])('refuses a deposit of "%s" as not a whole amount, counting and signing nothing', async amount => {
      const { service, repository, signAndBroadcast } = setup({});

      const refusal = await service.track(WALLET, [uact(amount)], signAndBroadcast).catch(error => error);

      expect(refusal).toMatchObject({ status: 400, message: `A deposit of "${amount}" uact is not a whole amount` });
      expect(repository.reserve).not.toHaveBeenCalled();
      expect(signAndBroadcast).not.toHaveBeenCalled();
    });

    it("returns the landed transaction even when recording it fails, and says the record is missing", async () => {
      const { service, repository, logger, signAndBroadcast } = setup({});
      const failure = new Error("connection reset");
      repository.settle.mockRejectedValue(failure);

      await expect(service.track(WALLET, [uact("5")], signAndBroadcast)).resolves.toBe(LANDED_TX);
      expect(logger.error).toHaveBeenCalledExactlyOnceWith({
        event: "FUNDING_OUTFLOW_UNSETTLED",
        reservationIds: ["reservation-1"],
        status: "landed",
        txHash: "LANDED",
        error: failure
      });
    });
  });

  describe("when a limit is set", () => {
    it("refuses a deposit that takes all wallets together past an enforced limit, takes it back and signs nothing", async () => {
      const { service, repository, logger, signAndBroadcast } = setup({
        limits: [createLimit({ maxAmount: 100n, isEnforced: true })],
        usage: { total: 101n, wallet: 5n }
      });

      const refusal = await service.track(WALLET, [uact("5")], signAndBroadcast).catch(error => error);

      expect(refusal).toMatchObject({ status: 429, message: OVER_LIMIT_MESSAGE });
      expect(signAndBroadcast).not.toHaveBeenCalled();
      expect(repository.settle).toHaveBeenCalledExactlyOnceWith(["reservation-1"], "released", undefined);
      expect(logger.error).toHaveBeenCalledExactlyOnceWith({
        event: "FUNDING_OUTFLOW_LIMIT_EXCEEDED",
        walletAddress: WALLET,
        scope: "total",
        denom: "uact",
        isLimitOfThisWalletAlone: false,
        usedAmount: "101",
        maxAmount: "100",
        isEnforced: true
      });
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("refuses a deposit that takes one wallet past the enforced limit of each wallet", async () => {
      const { service, signAndBroadcast } = setup({
        limits: [createLimit({ scope: "wallet", maxAmount: 10n, isEnforced: true })],
        usage: { total: 500n, wallet: 11n }
      });

      await expect(service.track(WALLET, [uact("5")], signAndBroadcast)).rejects.toThrow(OVER_LIMIT_MESSAGE);
      expect(signAndBroadcast).not.toHaveBeenCalled();
    });

    it("still refuses when taking the refused deposit back fails", async () => {
      const { service, repository, signAndBroadcast } = setup({
        limits: [createLimit({ maxAmount: 100n, isEnforced: true })],
        usage: { total: 101n, wallet: 5n }
      });
      repository.settle.mockRejectedValue(new Error("connection reset"));

      await expect(service.track(WALLET, [uact("5")], signAndBroadcast)).rejects.toThrow(OVER_LIMIT_MESSAGE);
      expect(signAndBroadcast).not.toHaveBeenCalled();
    });

    it("signs a deposit past a limit that is only reported, and reports it", async () => {
      const { service, repository, logger, signAndBroadcast } = setup({
        limits: [createLimit({ maxAmount: 100n, isEnforced: false })],
        usage: { total: 101n, wallet: 5n }
      });

      await expect(service.track(WALLET, [uact("5")], signAndBroadcast)).resolves.toBe(LANDED_TX);
      expect(repository.settle).toHaveBeenCalledExactlyOnceWith(["reservation-1"], "landed", "LANDED");
      expect(logger.error).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ event: "FUNDING_OUTFLOW_LIMIT_EXCEEDED", isEnforced: false }));
    });

    it("refuses when one of two limits passed is enforced, reporting both", async () => {
      const { service, logger, signAndBroadcast } = setup({
        limits: [createLimit({ maxAmount: 100n, isEnforced: false }), createLimit({ scope: "wallet", maxAmount: 10n, isEnforced: true })],
        usage: { total: 101n, wallet: 11n }
      });

      await expect(service.track(WALLET, [uact("5")], signAndBroadcast)).rejects.toThrow(OVER_LIMIT_MESSAGE);
      expect(logger.error).toHaveBeenCalledTimes(2);
    });

    it("signs a deposit that brings the amount exactly to an enforced limit, and warns that the limit is near", async () => {
      const { service, logger, signAndBroadcast } = setup({
        limits: [createLimit({ maxAmount: 100n, isEnforced: true })],
        usage: { total: 100n, wallet: 5n }
      });

      await expect(service.track(WALLET, [uact("5")], signAndBroadcast)).resolves.toBe(LANDED_TX);
      expect(logger.error).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledExactlyOnceWith({
        event: "FUNDING_OUTFLOW_LIMIT_NEARING",
        walletAddress: WALLET,
        scope: "total",
        denom: "uact",
        isLimitOfThisWalletAlone: false,
        usedAmount: "100",
        maxAmount: "100",
        isEnforced: true
      });
    });

    it("warns from four fifths of a limit on, and stays quiet below", async () => {
      const limits = [createLimit({ maxAmount: 1000n })];
      const atFourFifths = setup({ limits, usage: { total: 800n, wallet: 5n } });
      const justBelow = setup({ limits, usage: { total: 799n, wallet: 5n } });

      await atFourFifths.service.track(WALLET, [uact("5")], atFourFifths.signAndBroadcast);
      await justBelow.service.track(WALLET, [uact("5")], justBelow.signAndBroadcast);

      expect(atFourFifths.logger.warn).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ event: "FUNDING_OUTFLOW_LIMIT_NEARING", usedAmount: "800" }));
      expect(justBelow.logger.warn).not.toHaveBeenCalled();
    });

    it("holds a wallet to the limit set for it alone rather than the one set for each wallet", async () => {
      const { service, logger, signAndBroadcast } = setup({
        limits: [
          createLimit({ scope: "wallet", maxAmount: 10n, isEnforced: true }),
          createLimit({ scope: "wallet", walletAddress: WALLET, maxAmount: 1000n, isEnforced: true })
        ],
        usage: { total: 500n, wallet: 900n }
      });

      await expect(service.track(WALLET, [uact("5")], signAndBroadcast)).resolves.toBe(LANDED_TX);
      expect(logger.warn).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ event: "FUNDING_OUTFLOW_LIMIT_NEARING", isLimitOfThisWalletAlone: true, maxAmount: "1000" })
      );
    });

    it("ignores a limit set for another wallet alone and one set for another denom", async () => {
      const { service, logger, signAndBroadcast } = setup({
        limits: [
          createLimit({ scope: "wallet", walletAddress: "akash1someoneelse", maxAmount: 1n, isEnforced: true }),
          createLimit({ denom: "uakt", maxAmount: 1n, isEnforced: true }),
          createLimit({ denom: "uakt", scope: "wallet", maxAmount: 1n, isEnforced: true })
        ],
        usage: { total: 500n, wallet: 500n }
      });

      await expect(service.track(WALLET, [uact("5")], signAndBroadcast)).resolves.toBe(LANDED_TX);
      expect(logger.error).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe("when the database cannot be reached", () => {
    it("signs a deposit uncounted on limits read within the last minute that enforce nothing, and says so", async () => {
      const { service, repository, logger, signAndBroadcast } = setup({ limits: [createLimit({ isEnforced: false })], now: "2026-11-28T10:00:00.000Z" });
      await service.load();
      const failure = new Error("connection reset");
      repository.findLimits.mockRejectedValue(failure);

      vi.setSystemTime("2026-11-28T10:01:00.000Z");

      await expect(service.track(WALLET, [uact("5")], signAndBroadcast)).resolves.toBe(LANDED_TX);
      expect(repository.reserve).not.toHaveBeenCalled();
      expect(repository.settle).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledExactlyOnceWith({ event: "FUNDING_OUTFLOW_UNCOUNTED", isUncountedAllowed: true, error: failure });
    });

    it("refuses a deposit when a limit read within the last minute is enforced", async () => {
      const { service, repository, logger, signAndBroadcast } = setup({ limits: [createLimit({ isEnforced: true })] });
      await service.load();
      const failure = new Error("connection reset");
      repository.findLimits.mockRejectedValue(failure);

      const refusal = await service.track(WALLET, [uact("5")], signAndBroadcast).catch(error => error);

      expect(refusal).toMatchObject({ status: 503, message: UNCOUNTED_MESSAGE, cause: failure });
      expect(signAndBroadcast).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledExactlyOnceWith({ event: "FUNDING_OUTFLOW_UNCOUNTED", isUncountedAllowed: false, error: failure });
    });

    it("refuses a deposit once the limits were last read more than a minute ago, since one may be enforced by now", async () => {
      const { service, repository, signAndBroadcast } = setup({ now: "2026-11-28T10:00:00.000Z" });
      await service.load();
      repository.findLimits.mockRejectedValue(new Error("connection reset"));

      vi.setSystemTime("2026-11-28T10:01:00.001Z");

      await expect(service.track(WALLET, [uact("5")], signAndBroadcast)).rejects.toThrow(UNCOUNTED_MESSAGE);
      expect(signAndBroadcast).not.toHaveBeenCalled();
    });

    it("refuses a deposit when the limits were never read", async () => {
      const { service, repository, signAndBroadcast } = setup({});
      repository.findLimits.mockRejectedValue(new Error("connection reset"));

      await expect(service.track(WALLET, [uact("5")], signAndBroadcast)).rejects.toThrow(UNCOUNTED_MESSAGE);
    });

    it("signs a deposit it counted but could not check while nothing is enforced, and still records how it ended", async () => {
      const { service, repository, signAndBroadcast } = setup({});
      repository.sumSince.mockRejectedValue(new Error("statement timeout"));

      await expect(service.track(WALLET, [uact("5")], signAndBroadcast)).resolves.toBe(LANDED_TX);
      expect(repository.settle).toHaveBeenCalledExactlyOnceWith(["reservation-1"], "landed", "LANDED");
    });

    it("refuses a deposit it counted but could not check while a limit is enforced, and takes it back", async () => {
      const { service, repository, signAndBroadcast } = setup({ limits: [createLimit({ isEnforced: true })] });
      repository.sumSince.mockRejectedValue(new Error("statement timeout"));

      await expect(service.track(WALLET, [uact("5")], signAndBroadcast)).rejects.toThrow(UNCOUNTED_MESSAGE);
      expect(signAndBroadcast).not.toHaveBeenCalled();
      expect(repository.settle).toHaveBeenCalledExactlyOnceWith(["reservation-1"], "released", undefined);
    });

    it("still refuses that deposit when taking it back fails too, and says which rows are left", async () => {
      const { service, repository, logger, signAndBroadcast } = setup({ limits: [createLimit({ isEnforced: true })] });
      repository.sumSince.mockRejectedValue(new Error("statement timeout"));
      const failure = new Error("connection reset");
      repository.settle.mockRejectedValue(failure);

      await expect(service.track(WALLET, [uact("5")], signAndBroadcast)).rejects.toThrow(UNCOUNTED_MESSAGE);
      expect(logger.error).toHaveBeenCalledWith({
        event: "FUNDING_OUTFLOW_UNSETTLED",
        reservationIds: ["reservation-1"],
        status: "released",
        txHash: undefined,
        error: failure
      });
    });

    it("has nothing to take back for a deposit refused before it was counted", async () => {
      const { service, repository, signAndBroadcast } = setup({ limits: [createLimit({ isEnforced: true })] });
      await service.load();
      repository.reserve.mockRejectedValue(new Error("connection reset"));

      await expect(service.track(WALLET, [uact("5")], signAndBroadcast)).rejects.toThrow(UNCOUNTED_MESSAGE);
      expect(repository.settle).not.toHaveBeenCalled();
    });
  });

  function uact(amount: string) {
    return { denom: "uact", amount };
  }

  function createLimit(overrides: Partial<FundingOutflowLimit> = {}): FundingOutflowLimit {
    return {
      id: "0b0e9d0a-4f6b-4f43-8d53-4f1b8f0f6a10",
      denom: "uact",
      scope: "total",
      walletAddress: null,
      maxAmount: 1_000_000n,
      isEnforced: false,
      setBy: "operator",
      setAt: new Date("2026-11-28T09:00:00.000Z"),
      ...overrides
    };
  }

  function setup(input: { isConfigured?: boolean; limits?: FundingOutflowLimit[]; usage?: OutflowUsage; now?: string }) {
    vi.useFakeTimers({ toFake: ["Date"] });
    if (input.now) vi.setSystemTime(input.now);

    const database = mock<FundingControlsDatabase>({ isConfigured: input.isConfigured ?? true });
    const repository = mock<FundingOutflowRepository>();
    repository.findLimits.mockResolvedValue(input.limits ?? []);
    repository.reserve.mockResolvedValue(["reservation-1"]);
    repository.sumSince.mockImplementation(async ({ denoms }) => new Map(denoms.map(denom => [denom, input.usage ?? { total: 5n, wallet: 5n }])));
    const logger = mock<LoggerService>();
    const signAndBroadcast = vi.fn<() => Promise<{ code: number; hash: string }>>().mockResolvedValue(LANDED_TX);

    return { service: new FundingOutflowService(database, repository, logger), repository, logger, signAndBroadcast };
  }
});
