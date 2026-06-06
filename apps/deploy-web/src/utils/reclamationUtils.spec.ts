import { describe, expect, it } from "vitest";

import type { DeploymentGroup, LeaseDto } from "@src/types/deployment";
import { classifyLeaseCloseReason, getLeaseCloseReasonLabel, getReclamationDeadline, isLeaseLive, isProviderReclaimed, isReclaiming } from "./reclamationUtils";

describe("reclamationUtils", () => {
  describe("classifyLeaseCloseReason", () => {
    it("returns 'unknown' when reason is missing", () => {
      expect(classifyLeaseCloseReason(undefined)).toBe("unknown");
      expect(classifyLeaseCloseReason("")).toBe("unknown");
    });

    it("classifies the invalid zero reason as 'unknown'", () => {
      expect(classifyLeaseCloseReason("0")).toBe("unknown");
      expect(classifyLeaseCloseReason("lease_closed_invalid")).toBe("unknown");
    });

    it("classifies owner range (1..9999) as 'tenant'", () => {
      expect(classifyLeaseCloseReason("1")).toBe("tenant");
      expect(classifyLeaseCloseReason("9999")).toBe("tenant");
      expect(classifyLeaseCloseReason("lease_closed_owner")).toBe("tenant");
    });

    it("classifies provider range (10000..19999) as 'provider'", () => {
      expect(classifyLeaseCloseReason("10000")).toBe("provider");
      expect(classifyLeaseCloseReason("19999")).toBe("provider");
      expect(classifyLeaseCloseReason("lease_closed_reason_unstable")).toBe("provider");
      expect(classifyLeaseCloseReason("lease_closed_reason_manifest_timeout")).toBe("provider");
    });

    it("classifies network range (20000..29999) as 'network'", () => {
      expect(classifyLeaseCloseReason("20000")).toBe("network");
      expect(classifyLeaseCloseReason("lease_closed_reason_insufficient_funds")).toBe("network");
    });

    it("returns 'unknown' for UNRECOGNIZED / unmapped names", () => {
      expect(classifyLeaseCloseReason("-1")).toBe("unknown");
      expect(classifyLeaseCloseReason("UNRECOGNIZED")).toBe("unknown");
      expect(classifyLeaseCloseReason("not_a_real_reason")).toBe("unknown");
    });
  });

  describe("getLeaseCloseReasonLabel", () => {
    it("returns distinct copy for each bucket", () => {
      expect(getLeaseCloseReasonLabel("lease_closed_owner")).toBe("Closed by you");
      expect(getLeaseCloseReasonLabel("lease_closed_reason_unstable")).toBe("Closed by provider (workloads unstable)");
      expect(getLeaseCloseReasonLabel("lease_closed_reason_decommission")).toBe("Closed by provider (decommissioned)");
      expect(getLeaseCloseReasonLabel("lease_closed_reason_unspecified")).toBe("Closed by provider");
      expect(getLeaseCloseReasonLabel("lease_closed_reason_manifest_timeout")).toBe("Closed by provider (manifest timeout)");
      expect(getLeaseCloseReasonLabel("lease_closed_reason_insufficient_funds")).toBe("Closed (insufficient funds)");
      expect(getLeaseCloseReasonLabel(undefined)).toBe("Closed");
    });

    it("never returns a raw enum name", () => {
      expect(getLeaseCloseReasonLabel("lease_closed_reason_unstable")).not.toMatch(/lease_closed/);
    });
  });

  describe("getReclamationDeadline", () => {
    it("converts unix seconds to a Date", () => {
      const lease = createLease({ reclamation: { deadline: 1_700_000_000 } });
      expect(getReclamationDeadline(lease)).toEqual(new Date(1_700_000_000 * 1000));
    });

    it("returns null when reclamation is absent", () => {
      expect(getReclamationDeadline(createLease())).toBeNull();
    });

    it("returns null for a 0 / NaN / non-finite deadline", () => {
      expect(getReclamationDeadline(createLease({ reclamation: { deadline: 0 } }))).toBeNull();
      expect(getReclamationDeadline(createLease({ reclamation: { deadline: NaN } }))).toBeNull();
      expect(getReclamationDeadline(createLease({ reclamation: { deadline: Infinity } }))).toBeNull();
      expect(getReclamationDeadline(createLease({ reclamation: { deadline: -Infinity } }))).toBeNull();
    });
  });

  describe("isReclaiming", () => {
    it("is true only for the reclaiming state", () => {
      expect(isReclaiming(createLease({ state: "reclaiming" }))).toBe(true);
      expect(isReclaiming(createLease({ state: "active" }))).toBe(false);
      expect(isReclaiming(createLease({ state: "closed" }))).toBe(false);
    });
  });

  describe("isLeaseLive", () => {
    it("treats active and reclaiming leases as live", () => {
      expect(isLeaseLive(createLease({ state: "active" }))).toBe(true);
      expect(isLeaseLive(createLease({ state: "reclaiming" }))).toBe(true);
    });

    it("treats closed / insufficient_funds leases as not live", () => {
      expect(isLeaseLive(createLease({ state: "closed" }))).toBe(false);
      expect(isLeaseLive(createLease({ state: "insufficient_funds" }))).toBe(false);
    });
  });

  describe("isProviderReclaimed", () => {
    it("is true for a closed lease with reclamation evidence (startedAt > 0)", () => {
      expect(isProviderReclaimed(createLease({ state: "closed", reclamation: { startedAt: "1700000000" } }))).toBe(true);
    });

    it("is true for a closed lease whose group is paused", () => {
      expect(isProviderReclaimed(createLease({ state: "closed", groupState: "paused" }))).toBe(true);
    });

    it("is false for a tenant-closed lease with no reclamation evidence", () => {
      expect(isProviderReclaimed(createLease({ state: "closed", reason: "lease_closed_owner" }))).toBe(false);
    });

    it("is false on a bare provider-reason close with no reclamation evidence", () => {
      expect(isProviderReclaimed(createLease({ state: "closed", reason: "lease_closed_reason_unstable" }))).toBe(false);
    });

    it("is false while the lease is still in the live reclaiming grace period", () => {
      expect(isProviderReclaimed(createLease({ state: "reclaiming", reclamation: { startedAt: "1700000000" } }))).toBe(false);
    });
  });

  function createLease(
    overrides: {
      state?: string;
      reason?: string;
      groupState?: string;
      reclamation?: LeaseDto["reclamation"];
    } = {}
  ): LeaseDto {
    return {
      id: "1",
      owner: "owner1",
      provider: "provider1",
      dseq: "1",
      gseq: 1,
      oseq: 1,
      state: overrides.state ?? "active",
      price: { denom: "uakt", amount: "100" },
      cpuAmount: 0,
      memoryAmount: 0,
      storageAmount: 0,
      reason: overrides.reason,
      reclamation: overrides.reclamation,
      group: { state: overrides.groupState ?? "open" } as DeploymentGroup
    } as LeaseDto;
  }
});
