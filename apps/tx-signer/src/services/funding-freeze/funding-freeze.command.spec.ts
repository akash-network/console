import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { FundingFreeze } from "@src/model-schemas";
import type { FundingFreezeRepository } from "@src/repositories/funding-freeze/funding-freeze.repository";
import { runFundingFreezeCommand } from "./funding-freeze.command";

const FROZEN_LINE = "Funding is frozen since 2026-11-28T09:00:00.000Z by on-call: funding key suspected leaked";

describe(runFundingFreezeCommand.name, () => {
  describe("status", () => {
    it("says funding is not frozen while no freeze stands", async () => {
      const { repository } = setup({});

      await expect(runFundingFreezeCommand(["status"], repository)).resolves.toBe("Funding is not frozen.");
    });

    it("says since when, by whom and why funding is frozen", async () => {
      const { repository } = setup({ activeFreeze: createFreeze() });

      await expect(runFundingFreezeCommand(["status"], repository)).resolves.toBe(FROZEN_LINE);
    });
  });

  describe("freeze", () => {
    it("freezes funding with the reason and the operator it was given, trimmed", async () => {
      const { repository } = setup({});
      repository.create.mockResolvedValue(createFreeze());

      const line = await runFundingFreezeCommand(["freeze", "--reason", "  funding key suspected leaked ", "--by", " on-call "], repository);

      expect(repository.create).toHaveBeenCalledExactlyOnceWith({ reason: "funding key suspected leaked", frozenBy: "on-call" });
      expect(line).toBe(FROZEN_LINE);
    });

    it("leaves a standing freeze as it is and says so", async () => {
      const { repository } = setup({ activeFreeze: createFreeze() });

      const line = await runFundingFreezeCommand(["freeze", "--reason", "again", "--by", "someone else"], repository);

      expect(repository.create).not.toHaveBeenCalled();
      expect(line).toBe(`Nothing changed. ${FROZEN_LINE}`);
    });

    it.each([
      ["no reason", ["freeze", "--by", "on-call"]],
      ["a blank reason", ["freeze", "--reason", "  ", "--by", "on-call"]],
      ["no operator", ["freeze", "--reason", "drill"]],
      ["a blank operator", ["freeze", "--reason", "drill", "--by", " "]]
    ])("refuses to freeze with %s", async (_case, args) => {
      const { repository } = setup({});

      await expect(runFundingFreezeCommand(args, repository)).rejects.toThrow("freeze needs --reason and --by\nUsage:");
      expect(repository.findActive).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe("lift", () => {
    it("lifts the standing freeze in the name of the operator it was given, trimmed", async () => {
      const { repository } = setup({});
      repository.liftActive.mockResolvedValue([createFreeze()]);

      const line = await runFundingFreezeCommand(["lift", "--by", " on-call "], repository);

      expect(repository.liftActive).toHaveBeenCalledExactlyOnceWith({ liftedBy: "on-call" });
      expect(line).toBe("Funding is no longer frozen. Each signer applies that on its next request.");
    });

    it("says nothing changed when no freeze stood", async () => {
      const { repository } = setup({});
      repository.liftActive.mockResolvedValue([]);

      await expect(runFundingFreezeCommand(["lift", "--by", "on-call"], repository)).resolves.toBe("Nothing changed. Funding is not frozen.");
    });

    it.each([
      ["no operator", ["lift"]],
      ["a blank operator", ["lift", "--by", " "]]
    ])("refuses to lift with %s", async (_case, args) => {
      const { repository } = setup({});

      await expect(runFundingFreezeCommand(args, repository)).rejects.toThrow("lift needs --by\nUsage:");
      expect(repository.liftActive).not.toHaveBeenCalled();
    });
  });

  it.each([
    ["no command", []],
    ["a command it does not know", ["thaw"]],
    ["a command it does not know that names an operator", ["thaw", "--by", "on-call"]]
  ])("answers %s with how it is used, changing nothing", async (_case, args) => {
    const { repository } = setup({});

    await expect(runFundingFreezeCommand(args, repository)).rejects.toThrow(
      'Usage:\n  funding-freeze status\n  funding-freeze freeze --reason "<why>" --by <who>\n  funding-freeze lift --by <who>'
    );
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.liftActive).not.toHaveBeenCalled();
  });

  it.each([
    ["a word after lift", ["lift", "yes", "--by", "on-call"], "yes"],
    ["a reason left unquoted", ["freeze", "--reason", "key", "compromised", "--by", "on-call"], "compromised"],
    ["two words after status", ["status", "right", "now"], "right now"]
  ])("refuses %s instead of dropping it, changing nothing", async (_case, args, unexpected) => {
    const { repository } = setup({});

    await expect(runFundingFreezeCommand(args, repository)).rejects.toThrow(`Unexpected "${unexpected}". Put a value with spaces in quotes.\nUsage:`);
    expect(repository.findActive).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.liftActive).not.toHaveBeenCalled();
  });

  it("refuses an option it does not know", async () => {
    const { repository } = setup({});

    await expect(runFundingFreezeCommand(["freeze", "--because", "drill"], repository)).rejects.toThrow("--because");
  });

  function createFreeze(): FundingFreeze {
    return {
      id: "7c0f3f0e-5a3b-4a53-9a0c-6f6f3a2f8f11",
      reason: "funding key suspected leaked",
      frozenBy: "on-call",
      frozenAt: new Date("2026-11-28T09:00:00.000Z"),
      liftedBy: null,
      liftedAt: null
    };
  }

  function setup(input: { activeFreeze?: FundingFreeze }) {
    const repository = mock<FundingFreezeRepository>();
    repository.findActive.mockResolvedValue(input.activeFreeze);

    return { repository };
  }
});
