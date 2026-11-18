import { describe, expect, it } from "vitest";

import { CreateTemplateReportRequestSchema } from "./template-report.schema";

describe("CreateTemplateReportRequestSchema", () => {
  it.each(["malware_or_miner", "leaks_secrets", "impersonation", "spam", "broken", "other"])("accepts the reason %s without details", reason => {
    expect(CreateTemplateReportRequestSchema.parse({ data: { reason } })).toEqual({ data: { reason } });
  });

  it("refuses a reason outside the list", () => {
    expect(CreateTemplateReportRequestSchema.safeParse({ data: { reason: "rude" } }).success).toBe(false);
  });

  it("trims the details and keeps their line breaks and tabs", () => {
    const parsed = CreateTemplateReportRequestSchema.parse({ data: { reason: "broken", details: "  It fails:\r\n\tno lease.\n " } });

    expect(parsed.data.details).toBe("It fails:\r\n\tno lease.");
  });

  it("accepts details of exactly 1000 characters and refuses one more", () => {
    const atLimit = CreateTemplateReportRequestSchema.safeParse({ data: { reason: "spam", details: "d".repeat(1000) } });
    const overLimit = CreateTemplateReportRequestSchema.safeParse({ data: { reason: "spam", details: "d".repeat(1001) } });

    expect(atLimit.success).toBe(true);
    expect(overLimit.success).toBe(false);
  });

  it.each([String.fromCharCode(0), String.fromCharCode(27), String.fromCharCode(127), String.fromCharCode(8)])(
    "refuses details holding the control character %j",
    control => {
      const result = CreateTemplateReportRequestSchema.safeParse({ data: { reason: "spam", details: `Looks${control}odd` } });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe("Details must be readable text");
    }
  );

  it("accepts details in any script, with emoji", () => {
    const details = "Ça mine du Monero 🚨 — 挖矿";

    expect(CreateTemplateReportRequestSchema.parse({ data: { reason: "malware_or_miner", details } }).data.details).toBe(details);
  });
});
