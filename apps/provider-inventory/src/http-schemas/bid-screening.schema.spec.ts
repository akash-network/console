import { AuditorSelectionMode, CapabilityFlag, VerificationTier } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { describe, expect, it } from "vitest";

import { VerificationRequirementSchema } from "./bid-screening.schema";

describe("VerificationRequirementSchema", () => {
  it("accepts the generated GroupSpec verification shape", () => {
    const result = VerificationRequirementSchema.parse({
      minTier: VerificationTier.verification_tier_verified,
      requiredCapabilities: [CapabilityFlag.capability_persistent_storage],
      requiredAuditors: ["akash1auditor"],
      auditorMode: AuditorSelectionMode.auditor_selection_mode_all,
      minAuditorCount: 2
    });

    expect(result).toEqual({
      minTier: VerificationTier.verification_tier_verified,
      requiredCapabilities: [CapabilityFlag.capability_persistent_storage],
      requiredAuditors: ["akash1auditor"],
      auditorMode: AuditorSelectionMode.auditor_selection_mode_all,
      minAuditorCount: 2
    });
  });

  it("defaults generated repeated and scalar fields", () => {
    expect(VerificationRequirementSchema.parse({ minTier: VerificationTier.verification_tier_identified })).toEqual({
      minTier: VerificationTier.verification_tier_identified,
      requiredCapabilities: [],
      requiredAuditors: [],
      auditorMode: AuditorSelectionMode.auditor_selection_mode_unspecified,
      minAuditorCount: 0
    });
  });

  it("rejects capabilities that are not defined by AEP-86", () => {
    const result = VerificationRequirementSchema.safeParse({
      minTier: VerificationTier.verification_tier_identified,
      requiredCapabilities: [999]
    });

    expect(result.success).toBe(false);
  });

  it("rejects filters on a tier-zero requirement", () => {
    const result = VerificationRequirementSchema.safeParse({
      minTier: VerificationTier.verification_tier_unspecified,
      requiredAuditors: ["akash1auditor"]
    });

    expect(result.success).toBe(false);
  });
});
