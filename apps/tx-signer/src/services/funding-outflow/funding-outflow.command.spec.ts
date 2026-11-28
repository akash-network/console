import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { FundingOutflowLimit } from "@src/model-schemas";
import type { FundingOutflowRepository } from "@src/repositories/funding-outflow/funding-outflow.repository";
import { runFundingOutflowCommand } from "./funding-outflow.command";

const USAGE_START = "Usage:\n  funding-outflow status\n  funding-outflow set-limit";
const SET_TOTAL_LIMIT = ["set-limit", "--denom", "uact", "--scope", "total", "--max", "5000", "--mode", "report", "--by", "on-call"];

describe(runFundingOutflowCommand.name, () => {
  describe("status", () => {
    it("says nothing left the wallets, no limit is set and no wallet took anything, for an empty database", async () => {
      const { repository } = setup();

      await expect(runFundingOutflowCommand(["status"], repository)).resolves.toBe(
        ["Left the funding wallets in the last 24 hours:", "  none", "Limits:", "  none", "Wallets that took the most:", "  none"].join("\n")
      );
    });

    it("lists what left per denom, every limit with its mode and who set it, and the ten wallets that took the most", async () => {
      const { repository } = setup();
      repository.sumByDenomSince.mockResolvedValue(
        new Map([
          ["uact", 1200n],
          ["uakt", 30n]
        ])
      );
      repository.findLimits.mockResolvedValue([
        createLimit({ scope: "wallet", walletAddress: "akash1big", maxAmount: 900n, isEnforced: true, setBy: "maxime" }),
        createLimit({ scope: "wallet", maxAmount: 100n }),
        createLimit({ scope: "total", maxAmount: 5000n, isEnforced: true })
      ]);
      repository.sumByWalletSince.mockResolvedValue([
        { walletAddress: "akash1big", denom: "uact", amount: 700n },
        { walletAddress: "akash1small", denom: "uakt", amount: 30n }
      ]);

      const lines = await runFundingOutflowCommand(["status"], repository);

      expect(lines).toBe(
        [
          "Left the funding wallets in the last 24 hours:",
          "  1200 uact",
          "  30 uakt",
          "Limits:",
          "  uact, all wallets together: 5000 in 24 hours, enforced, set by on-call",
          "  uact, each wallet: 100 in 24 hours, reported only, set by on-call",
          "  uact, wallet akash1big: 900 in 24 hours, enforced, set by maxime",
          "Wallets that took the most:",
          "  akash1big: 700 uact",
          "  akash1small: 30 uakt"
        ].join("\n")
      );
      expect(repository.sumByDenomSince).toHaveBeenCalledExactlyOnceWith({ windowHours: 24 });
      expect(repository.sumByWalletSince).toHaveBeenCalledExactlyOnceWith({ windowHours: 24, limit: 10 });
    });
  });

  describe("set-limit", () => {
    it("sets a reported limit on all wallets together", async () => {
      const { repository } = setup();
      repository.setLimit.mockResolvedValue(createLimit({ maxAmount: 5000n }));

      const line = await runFundingOutflowCommand(SET_TOTAL_LIMIT, repository);

      expect(repository.setLimit).toHaveBeenCalledExactlyOnceWith({
        denom: "uact",
        scope: "total",
        walletAddress: undefined,
        maxAmount: 5000n,
        isEnforced: false,
        setBy: "on-call"
      });
      expect(line).toBe("Limit set. uact, all wallets together: 5000 in 24 hours, reported only, set by on-call");
    });

    it("sets an enforced limit on one wallet, trimming what it was given", async () => {
      const { repository } = setup();
      repository.setLimit.mockResolvedValue(createLimit({ scope: "wallet", walletAddress: "akash1big", maxAmount: 900n, isEnforced: true }));

      const line = await runFundingOutflowCommand(
        ["set-limit", "--denom", " uact ", "--scope", "wallet", "--wallet", " akash1big ", "--max", "900", "--mode", "enforce", "--by", " on-call "],
        repository
      );

      expect(repository.setLimit).toHaveBeenCalledExactlyOnceWith({
        denom: "uact",
        scope: "wallet",
        walletAddress: "akash1big",
        maxAmount: 900n,
        isEnforced: true,
        setBy: "on-call"
      });
      expect(line).toBe("Limit set. uact, wallet akash1big: 900 in 24 hours, enforced, set by on-call");
    });

    it("sets a limit on each wallet when the wallet scope names none", async () => {
      const { repository } = setup();
      repository.setLimit.mockResolvedValue(createLimit({ scope: "wallet", maxAmount: 100n }));

      await runFundingOutflowCommand(
        ["set-limit", "--denom", "uact", "--scope", "wallet", "--wallet", " ", "--max", "100", "--mode", "report", "--by", "x"],
        repository
      );

      expect(repository.setLimit).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ scope: "wallet", walletAddress: undefined }));
    });

    it.each([
      ["no denom", without("--denom"), "set-limit needs --denom"],
      ["a blank denom", withOption("--denom", " "), "set-limit needs --denom"],
      ["no scope", without("--scope"), "set-limit needs --scope total or --scope wallet"],
      ["a scope it does not know", withOption("--scope", "everyone"), "set-limit needs --scope total or --scope wallet"],
      ["a wallet under the total scope", [...SET_TOTAL_LIMIT, "--wallet", "akash1big"], "set-limit takes --wallet with --scope wallet only"],
      ["no amount", without("--max"), "set-limit needs --max as a whole amount above zero"],
      ["an amount of zero", withOption("--max", "0"), "set-limit needs --max as a whole amount above zero"],
      ["a fraction of an amount", withOption("--max", "1.5"), "set-limit needs --max as a whole amount above zero"],
      ["an amount with text after it", withOption("--max", "5000uact"), "set-limit needs --max as a whole amount above zero"],
      ["no mode", without("--mode"), "set-limit needs --mode report or --mode enforce"],
      ["a mode it does not know", withOption("--mode", "strict"), "set-limit needs --mode report or --mode enforce"],
      ["no operator", without("--by"), "set-limit needs --by"],
      ["a blank operator", withOption("--by", " "), "set-limit needs --by"]
    ])("refuses to set a limit with %s", async (_case, args, message) => {
      const { repository } = setup();

      await expect(runFundingOutflowCommand(args, repository)).rejects.toThrow(`${message}\n${USAGE_START}`);
      expect(repository.setLimit).not.toHaveBeenCalled();
    });
  });

  describe("remove-limit", () => {
    it("removes the limit it is pointed at and says which one", async () => {
      const { repository } = setup();
      repository.removeLimit.mockResolvedValue([createLimit({ scope: "wallet", walletAddress: "akash1big", maxAmount: 900n })]);

      const line = await runFundingOutflowCommand(["remove-limit", "--denom", "uact", "--scope", "wallet", "--wallet", "akash1big"], repository);

      expect(repository.removeLimit).toHaveBeenCalledExactlyOnceWith({ denom: "uact", scope: "wallet", walletAddress: "akash1big" });
      expect(line).toBe("Limit removed. uact, wallet akash1big: 900 in 24 hours, reported only, set by on-call");
    });

    it("says nothing changed when no such limit is set", async () => {
      const { repository } = setup();
      repository.removeLimit.mockResolvedValue([]);

      await expect(runFundingOutflowCommand(["remove-limit", "--denom", "uact", "--scope", "total"], repository)).resolves.toBe(
        "Nothing changed. No such limit is set."
      );
    });

    it.each([
      ["no denom", ["remove-limit", "--scope", "total"], "remove-limit needs --denom"],
      ["no scope", ["remove-limit", "--denom", "uact"], "remove-limit needs --scope total or --scope wallet"],
      [
        "a wallet under the total scope",
        ["remove-limit", "--denom", "uact", "--scope", "total", "--wallet", "akash1big"],
        "remove-limit takes --wallet with --scope wallet only"
      ]
    ])("refuses to remove a limit with %s", async (_case, args, message) => {
      const { repository } = setup();

      await expect(runFundingOutflowCommand(args, repository)).rejects.toThrow(`${message}\n${USAGE_START}`);
      expect(repository.removeLimit).not.toHaveBeenCalled();
    });
  });

  it.each([
    ["no command", []],
    ["a command it does not know", ["raise-limit"]],
    ["a command it does not know that carries everything a limit needs", ["raise-limit", ...SET_TOTAL_LIMIT.slice(1)]]
  ])("answers %s with how it is used, changing nothing", async (_case, args) => {
    const { repository } = setup();

    const refusal = await runFundingOutflowCommand(args, repository).catch(error => error);

    expect(refusal.message.startsWith(USAGE_START)).toBe(true);
    expect(repository.setLimit).not.toHaveBeenCalled();
    expect(repository.removeLimit).not.toHaveBeenCalled();
  });

  function without(option: string) {
    const at = SET_TOTAL_LIMIT.indexOf(option);

    return [...SET_TOTAL_LIMIT.slice(0, at), ...SET_TOTAL_LIMIT.slice(at + 2)];
  }

  function withOption(option: string, value: string) {
    return [...without(option), option, value];
  }

  function createLimit(overrides: Partial<FundingOutflowLimit> = {}): FundingOutflowLimit {
    return {
      id: "0b0e9d0a-4f6b-4f43-8d53-4f1b8f0f6a10",
      denom: "uact",
      scope: "total",
      walletAddress: null,
      maxAmount: 1_000_000n,
      isEnforced: false,
      setBy: "on-call",
      setAt: new Date("2026-11-28T09:00:00.000Z"),
      ...overrides
    };
  }

  function setup() {
    const repository = mock<FundingOutflowRepository>();
    repository.sumByDenomSince.mockResolvedValue(new Map());
    repository.findLimits.mockResolvedValue([]);
    repository.sumByWalletSince.mockResolvedValue([]);

    return { repository };
  }
});
