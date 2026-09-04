import { describe, expect, it } from "vitest";

import type { DeploymentGroup } from "@src/types/deployment";
import { getPlacementSecurityPolicy, isTierBelow } from "./placementVerificationModel";

describe("placementVerificationModel", () => {
  it("normalizes the on-chain placement requirement without merging legacy signedBy", () => {
    const result = getPlacementSecurityPolicy({
      group_spec: {
        requirements: {
          signed_by: { all_of: ["akash1legacy"], any_of: [] },
          attributes: [],
          verification: {
            min_tier: "verification_tier_established",
            required_capabilities: ["capability_confidential_computing", "capability_bare_metal"],
            required_auditors: ["akash1auditor"],
            auditor_mode: "auditor_selection_mode_all",
            min_auditor_count: 2
          }
        }
      }
    } as unknown as DeploymentGroup);

    expect(result).toEqual({
      legacySignedBy: { allOf: ["akash1legacy"], anyOf: [] },
      verification: {
        minTier: "L3",
        requiredCapabilities: ["confidential_computing", "bare_metal"],
        requiredAuditors: ["akash1auditor"],
        auditorMode: "all",
        minAuditorCount: 2
      }
    });
  });

  it("collapses empty legacy signedBy while retaining the verification policy", () => {
    const result = getPlacementSecurityPolicy({
      group_spec: {
        requirements: {
          signed_by: { all_of: [], any_of: [] },
          attributes: [],
          verification: {
            min_tier: "verification_tier_identified",
            required_capabilities: [],
            required_auditors: [],
            auditor_mode: "auditor_selection_mode_unspecified",
            min_auditor_count: 0
          }
        }
      }
    } as unknown as DeploymentGroup);

    expect(result.legacySignedBy).toBeNull();
    expect(result.verification).toEqual({ minTier: "L1", requiredCapabilities: [], requiredAuditors: [], auditorMode: "unknown", minAuditorCount: 0 });
  });

  it("detects only comparable tier demotions", () => {
    expect(isTierBelow("L1", "L2")).toBe(true);
    expect(isTierBelow("L3", "L2")).toBe(false);
    expect(isTierBelow(null, "L2")).toBe(false);
    expect(isTierBelow("unknown", "L2")).toBe(false);
  });

  it("maps the proto default tier to L0", () => {
    const result = getPlacementSecurityPolicy({
      group_spec: {
        requirements: {
          signed_by: { all_of: [], any_of: [] },
          attributes: [],
          verification: {
            min_tier: "verification_tier_unspecified",
            required_capabilities: [],
            required_auditors: [],
            auditor_mode: "auditor_selection_mode_unspecified",
            min_auditor_count: 0
          }
        }
      }
    } as unknown as DeploymentGroup);

    expect(result.verification?.minTier).toBe("L0");
  });
});
