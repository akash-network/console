import { describe, expect, it } from "vitest";

import { buildReport, formatReport, runCheck } from "@src/parity/report";

describe(runCheck.name, () => {
  it("reports a check whose construction throws as its own failed line", async () => {
    const result = await runCheck("balances", () => {
      throw new Error("No RPC endpoints available for network mainnet");
    });

    expect(result).toEqual({ name: "balances", status: "fail", summary: "threw: No RPC endpoints available for network mainnet", mismatches: [] });
  });

  it("reports a check whose run rejects as a failed line", async () => {
    const result = await runCheck("http", () => ({ name: "http", run: () => Promise.reject(new Error("fetch failed")) }));

    expect(result).toMatchObject({ name: "http", status: "fail", summary: "threw: fetch failed" });
  });

  it("passes a check's own result through", async () => {
    const result = await runCheck("daily-counts", () => ({
      name: "daily-counts",
      run: async () => ({ name: "daily-counts", status: "pass" as const, summary: "ok", mismatches: [] })
    }));

    expect(result.status).toBe("pass");
  });
});

describe(buildReport.name, () => {
  it("is ok only when no check failed, and renders every line", () => {
    const report = buildReport(
      [
        { name: "a", status: "pass", summary: "fine", mismatches: [] },
        { name: "b", status: "skipped", summary: "not configured", mismatches: [] }
      ],
      new Date("2026-09-26T03:30:00Z")
    );

    expect(report.ok).toBe(true);
    expect(formatReport(report)).toContain("[SKIPPED] b: not configured");
    expect(buildReport([{ name: "c", status: "fail", summary: "bad", mismatches: [] }], new Date()).ok).toBe(false);
  });
});
