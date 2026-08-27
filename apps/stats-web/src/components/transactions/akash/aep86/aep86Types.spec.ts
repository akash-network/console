import { describe, expect, it } from "vitest";

import { formatAep86Scalar, getAep86FieldLabel, toAep86DisplayFields } from "./aep86Formatting";
import { AEP86_EVENT_TYPE_URLS, AEP86_MESSAGE_TYPE_URLS, isAep86EventType, isAep86MessageType } from "./aep86Types";

describe("AEP-86 type dispatch", () => {
  it("recognizes every verification and maintenance message by full type URL", () => {
    expect(AEP86_MESSAGE_TYPE_URLS).toHaveLength(22);
    expect(AEP86_MESSAGE_TYPE_URLS.every(isAep86MessageType)).toBe(true);
  });

  it("recognizes every verification and maintenance event with or without a leading slash", () => {
    expect(AEP86_EVENT_TYPE_URLS).toHaveLength(33);
    expect(AEP86_EVENT_TYPE_URLS.every(isAep86EventType)).toBe(true);
    expect(isAep86EventType("akash.verification.v1.EventAttestationSubmitted")).toBe(true);
  });

  it("does not confuse update-params messages from different modules", () => {
    expect(isAep86MessageType("/akash.verification.v1.MsgUpdateParams")).toBe(true);
    expect(isAep86MessageType("/akash.provider.v1beta4.MsgUpdateParams")).toBe(false);
    expect(isAep86MessageType("MsgUpdateParams")).toBe(false);
  });
});

describe("AEP-86 record formatting", () => {
  it("formats tiers, capabilities, booleans, and field labels", () => {
    expect(formatAep86Scalar("verification_tier_established")).toBe("L3");
    expect(formatAep86Scalar("capability_persistent_storage")).toBe("Persistent Storage");
    expect(formatAep86Scalar(true)).toBe("Yes");
    expect(getAep86FieldLabel("audit_escrow_id")).toBe("Audit Escrow ID");
  });

  it("builds a readable attestation view without losing hashes or coin denominations", () => {
    expect(
      toAep86DisplayFields({
        provider: "akash1provider",
        tier: "verification_tier_identified",
        capabilities: ["capability_persistent_storage"],
        evidenceHash: "evidence-base64",
        fee: { amount: "10000000", denom: "uakt" },
        slashAuditorA: false
      })
    ).toEqual([
      { key: "provider", kind: "address", label: "Provider", value: "akash1provider" },
      { key: "tier", kind: "text", label: "Tier", value: "L1" },
      { key: "capabilities", kind: "text", label: "Capabilities", value: "Persistent Storage" },
      { key: "evidenceHash", kind: "text", label: "Evidence Hash", value: "evidence-base64" },
      { key: "fee", kind: "text", label: "Fee", value: "10000000 uakt" },
      { key: "slashAuditorA", kind: "text", label: "Slash Auditor A", value: "No" }
    ]);
  });

  it("formats provider maintenance event fields", () => {
    expect(
      toAep86DisplayFields({
        maintenanceId: "7",
        provider: "akash1provider",
        maintenanceType: "provider_maintenance_type_security",
        startsAt: "2026-08-24T10:00:00Z"
      })
    ).toEqual([
      { key: "maintenanceId", kind: "text", label: "Maintenance ID", value: "7" },
      { key: "provider", kind: "address", label: "Provider", value: "akash1provider" },
      { key: "maintenanceType", kind: "text", label: "Maintenance Type", value: "Security" },
      { key: "startsAt", kind: "text", label: "Starts At", value: "2026-08-24T10:00:00Z" }
    ]);
  });
});
