import { describe, expect, it, vi } from "vitest";

import { CliPromptService } from "./cli-prompt.service";

describe(CliPromptService.name, () => {
  it("writes the message followed by a newline to stdout", () => {
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const service = setup();

    service.writeLine("hello");

    expect(writeSpy).toHaveBeenCalledWith("hello\n");
    writeSpy.mockRestore();
  });

  it("does nothing on close when no interface was opened", () => {
    const service = setup();

    expect(() => service.close()).not.toThrow();
  });

  function setup() {
    return new CliPromptService();
  }
});
