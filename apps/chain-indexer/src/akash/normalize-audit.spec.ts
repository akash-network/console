import { describe, expect, it } from "vitest";

import { normalizeAuditMessage } from "@src/akash/normalize-audit";

describe("normalizeAuditMessage", () => {
  it("normalizes a legacy v1beta1 sign with its attributes", () => {
    const change = normalizeAuditMessage("/akash.audit.v1beta1.MsgSignProviderAttributes", {
      owner: "akash1owner",
      auditor: "akash1auditor",
      attributes: [
        { key: "region", value: "us-west" },
        { key: "tier", value: "community" }
      ]
    });

    expect(change).toEqual({
      kind: "providerAttributesSigned",
      owner: "akash1owner",
      auditor: "akash1auditor",
      attributes: [
        { key: "region", value: "us-west" },
        { key: "tier", value: "community" }
      ]
    });
  });

  it("normalizes a current v1 sign identically to the legacy eras", () => {
    const change = normalizeAuditMessage("/akash.audit.v1.MsgSignProviderAttributes", {
      owner: "akash1owner",
      auditor: "akash1auditor",
      attributes: []
    });

    expect(change).toEqual({ kind: "providerAttributesSigned", owner: "akash1owner", auditor: "akash1auditor", attributes: [] });
  });

  it("normalizes a keyed delete, dropping non-string keys", () => {
    const change = normalizeAuditMessage("/akash.audit.v1beta3.MsgDeleteProviderAttributes", {
      owner: "akash1owner",
      auditor: "akash1auditor",
      keys: ["region", 7, "tier"]
    });

    expect(change).toEqual({ kind: "providerAttributesUnsigned", owner: "akash1owner", auditor: "akash1auditor", keys: ["region", "tier"] });
  });

  it("normalizes a delete without keys to an empty list meaning delete-all", () => {
    const change = normalizeAuditMessage("/akash.audit.v1.MsgDeleteProviderAttributes", { owner: "akash1owner", auditor: "akash1auditor" });

    expect(change).toEqual({ kind: "providerAttributesUnsigned", owner: "akash1owner", auditor: "akash1auditor", keys: [] });
  });

  it("returns null when the owner or auditor is missing", () => {
    expect(normalizeAuditMessage("/akash.audit.v1.MsgSignProviderAttributes", { owner: "akash1owner" })).toBeNull();
    expect(normalizeAuditMessage("/akash.audit.v1.MsgDeleteProviderAttributes", { auditor: "akash1auditor" })).toBeNull();
  });

  it("returns null for unrelated type urls", () => {
    expect(normalizeAuditMessage("/akash.audit.v1beta4.MsgSignProviderAttributes", { owner: "a", auditor: "b" })).toBeNull();
    expect(normalizeAuditMessage("/akash.provider.v1beta4.MsgCreateProvider", {})).toBeNull();
  });
});
