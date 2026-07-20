import { describe, expect, it } from "vitest";

import {
  JSON_ENVELOPE_OVERHEAD_BYTES,
  MAX_COMMAND_ARG_BYTES,
  MAX_COMMAND_ARGS,
  MAX_STDIN_BYTES,
  SERVICE_NAME_MAX,
  SHELL_EXEC_BODY_LIMIT_BYTES,
  ShellExecRequestSchema
} from "./shell-exec.schema";

describe("ShellExecRequestSchema", () => {
  describe("stdin byte cap", () => {
    it("accepts stdin at exactly the byte cap", () => {
      const result = ShellExecRequestSchema.safeParse(base({ stdin: "A".repeat(MAX_STDIN_BYTES) }));
      expect(result.success).toBe(true);
    });

    it("rejects stdin one byte over the cap", () => {
      const result = ShellExecRequestSchema.safeParse(base({ stdin: "A".repeat(MAX_STDIN_BYTES + 1) }));
      expect(result.success).toBe(false);
    });

    it("counts UTF-8 bytes, not UTF-16 code units, so a short multi-byte string over the byte cap is rejected", () => {
      // "😀" is 2 UTF-16 code units but 4 UTF-8 bytes. This many are under MAX_STDIN_BYTES
      // by `.length` (code units) yet over it in bytes — a `z.string().max()` would wrongly pass.
      const emojiCount = Math.floor(MAX_STDIN_BYTES / 2);
      const value = "😀".repeat(emojiCount);
      expect(value.length).toBeLessThanOrEqual(MAX_STDIN_BYTES);
      expect(Buffer.byteLength(value, "utf8")).toBeGreaterThan(MAX_STDIN_BYTES);

      const result = ShellExecRequestSchema.safeParse(base({ stdin: value }));
      expect(result.success).toBe(false);
    });
  });

  describe("command caps", () => {
    it("accepts a command arg at exactly the per-arg byte cap", () => {
      const result = ShellExecRequestSchema.safeParse(base({ command: ["sh", "-c", "A".repeat(MAX_COMMAND_ARG_BYTES)] }));
      expect(result.success).toBe(true);
    });

    it("rejects a command arg one byte over the per-arg cap", () => {
      const result = ShellExecRequestSchema.safeParse(base({ command: ["sh", "-c", "A".repeat(MAX_COMMAND_ARG_BYTES + 1)] }));
      expect(result.success).toBe(false);
    });

    it("rejects more than the maximum number of command args", () => {
      const result = ShellExecRequestSchema.safeParse(base({ command: Array.from({ length: MAX_COMMAND_ARGS + 1 }, () => "x") }));
      expect(result.success).toBe(false);
    });

    it("rejects an empty command array", () => {
      const result = ShellExecRequestSchema.safeParse(base({ command: [] }));
      expect(result.success).toBe(false);
    });
  });

  describe("SHELL_EXEC_BODY_LIMIT_BYTES", () => {
    it("is derived arithmetically from the field caps (never hardcoded)", () => {
      expect(SHELL_EXEC_BODY_LIMIT_BYTES).toBe(MAX_COMMAND_ARGS * MAX_COMMAND_ARG_BYTES + MAX_STDIN_BYTES + SERVICE_NAME_MAX + JSON_ENVELOPE_OVERHEAD_BYTES);
    });

    it("leaves headroom above the largest single field cap so a schema-valid body is not rejected first", () => {
      expect(SHELL_EXEC_BODY_LIMIT_BYTES).toBeGreaterThan(MAX_STDIN_BYTES);
      expect(SHELL_EXEC_BODY_LIMIT_BYTES).toBeGreaterThan(MAX_COMMAND_ARGS * MAX_COMMAND_ARG_BYTES);
    });
  });
});

function base(overrides: Partial<{ command: string[]; service: string; timeout: number; stdin: string }>) {
  return {
    command: overrides.command ?? ["ls"],
    service: overrides.service ?? "web",
    timeout: overrides.timeout ?? 60,
    ...(overrides.stdin !== undefined ? { stdin: overrides.stdin } : {})
  };
}
