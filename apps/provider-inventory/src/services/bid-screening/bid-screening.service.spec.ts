import type { VerificationRequirement } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { AttestationStatus, AuditorSelectionMode, CapabilityFlag, VerificationTier } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import type { LoggerService } from "@akashnetwork/logging";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BidScreeningCandidate, BidScreeningRepository } from "@src/repositories/bid-screening/bid-screening.repository";
import type { DailyDowntimeRow, ProviderIncidentRepository } from "@src/repositories/provider-incident/provider-incident.repository";
import type { StoredProviderVerification } from "@src/types/provider-verification";
import type { ClusterInventoryMatcherService } from "../cluster-inventory-matcher/cluster-inventory-matcher.service";
import type { BidScreeningInput } from "./bid-screening.service";
import { BidScreeningService } from "./bid-screening.service";

describe(BidScreeningService.name, () => {
  describe("findMatchingProviders", () => {
    it("returns passing candidates with metadata", async () => {
      const { service, repository, matcher } = setup();
      repository.findCandidates.mockResolvedValue([makeCandidate("akash1abc")]);
      matcher.match.mockReturnValue({ matched: true });

      const results = await service.findMatchingProviders(makeRequest());

      expect(results).toEqual([
        {
          owner: "akash1abc",
          hostUri: "https://provider.example.com:8443",
          isAudited: false,
          createdAt: "2026-01-01T00:00:00.000Z",
          location: null,
          organization: null,
          incidents: []
        }
      ]);
    });

    it("threads candidate.location through to the result", async () => {
      const { service, repository, matcher } = setup();
      repository.findCandidates.mockResolvedValue([makeCandidate("akash1abc", { location: "us-west" })]);
      matcher.match.mockReturnValue({ matched: true });

      const results = await service.findMatchingProviders(makeRequest());

      expect(results[0].location).toBe("us-west");
    });

    it("threads candidate.organization through to the result", async () => {
      const { service, repository, matcher } = setup();
      repository.findCandidates.mockResolvedValue([makeCandidate("akash1abc", { organization: "Akash" })]);
      matcher.match.mockReturnValue({ matched: true });

      const results = await service.findMatchingProviders(makeRequest());

      expect(results[0].organization).toBe("Akash");
    });

    it("filters out candidates that fail matching", async () => {
      const { service, repository, matcher } = setup();
      repository.findCandidates.mockResolvedValue([makeCandidate("akash1abc"), makeCandidate("akash1def")]);
      matcher.match.mockReturnValueOnce({ matched: true }).mockReturnValueOnce({ matched: false, error: "INSUFFICIENT_CAPACITY" });

      const results = await service.findMatchingProviders(makeRequest());

      expect(results).toHaveLength(1);
      expect(results[0].owner).toBe("akash1abc");
    });

    it("passes the candidate's ClusterState directly to the matcher", async () => {
      const { service, repository, matcher } = setup();
      const candidate = makeCandidate("akash1abc");
      repository.findCandidates.mockResolvedValue([candidate]);
      matcher.match.mockReturnValue({ matched: true });

      await service.findMatchingProviders(makeRequest());

      expect(matcher.match).toHaveBeenCalledWith(candidate.cluster, expect.any(Array));
    });

    it("returns empty array when no candidates are returned", async () => {
      const { service, repository } = setup();
      repository.findCandidates.mockResolvedValue([]);

      const results = await service.findMatchingProviders(makeRequest());

      expect(results).toEqual([]);
    });

    it("returns empty array when all candidates fail matching", async () => {
      const { service, repository, matcher } = setup();
      repository.findCandidates.mockResolvedValue([makeCandidate("akash1abc")]);
      matcher.match.mockReturnValue({ matched: false, error: "INSUFFICIENT_CAPACITY" });

      const results = await service.findMatchingProviders(makeRequest());

      expect(results).toEqual([]);
    });

    it("calls findCandidates exactly once with parsed resource units and requirements", async () => {
      const { service, repository, matcher } = setup();
      repository.findCandidates.mockResolvedValue([]);
      matcher.match.mockReturnValue({ matched: true });
      const request = makeRequest({ signedBy: { allOf: ["aud-a"], anyOf: [] } });

      await service.findMatchingProviders(request);

      expect(repository.findCandidates).toHaveBeenCalledTimes(1);
      expect(repository.findCandidates).toHaveBeenCalledWith(expect.any(Array), request.requirements);
    });

    it("threads candidate.isAudited through to the result", async () => {
      const { service, repository, matcher } = setup();
      repository.findCandidates.mockResolvedValue([makeCandidate("akash1abc", { isAudited: true }), makeCandidate("akash1def", { isAudited: false })]);
      matcher.match.mockReturnValue({ matched: true });

      const results = await service.findMatchingProviders(makeRequest());

      expect(results.find(r => r.owner === "akash1abc")?.isAudited).toBe(true);
      expect(results.find(r => r.owner === "akash1def")?.isAudited).toBe(false);
    });

    it("groups flat incident rows into per-owner arrays on the results", async () => {
      const { service, repository, incidentRepository, matcher } = setup();
      repository.findCandidates.mockResolvedValue([makeCandidate("akash1abc"), makeCandidate("akash1def")]);
      matcher.match.mockReturnValue({ matched: true });
      incidentRepository.findDailyDowntimeByProviders.mockResolvedValue([
        makeDowntimeRow("akash1abc", { date: "2026-06-01", downtimeSeconds: 3600 }),
        makeDowntimeRow("akash1abc", { date: "2026-06-03", hasOpenIncident: true, downtimeSeconds: 7200 }),
        makeDowntimeRow("akash1def", { date: "2026-06-02", downtimeSeconds: 7200 })
      ]);

      const results = await service.findMatchingProviders(makeRequest());

      expect(results.find(r => r.owner === "akash1abc")?.incidents).toEqual([
        { date: "2026-06-01", hasOpenIncident: false, incidentCount: 1, downtimeSeconds: 3600 },
        { date: "2026-06-03", hasOpenIncident: true, incidentCount: 1, downtimeSeconds: 7200 }
      ]);
      expect(results.find(r => r.owner === "akash1def")?.incidents).toEqual([
        { date: "2026-06-02", hasOpenIncident: false, incidentCount: 1, downtimeSeconds: 7200 }
      ]);
    });

    it("defaults incidents to an empty array for a matched provider with no incident rows", async () => {
      const { service, repository, incidentRepository, matcher } = setup();
      repository.findCandidates.mockResolvedValue([makeCandidate("akash1abc")]);
      matcher.match.mockReturnValue({ matched: true });
      incidentRepository.findDailyDowntimeByProviders.mockResolvedValue([]);

      const results = await service.findMatchingProviders(makeRequest());

      expect(results[0].incidents).toEqual([]);
    });

    it("does not query incidents when the matched set is empty", async () => {
      const { service, repository, incidentRepository, matcher } = setup();
      repository.findCandidates.mockResolvedValue([makeCandidate("akash1abc")]);
      matcher.match.mockReturnValue({ matched: false, error: "INSUFFICIENT_CAPACITY" });

      const results = await service.findMatchingProviders(makeRequest());

      expect(results).toEqual([]);
      expect(incidentRepository.findDailyDowntimeByProviders).not.toHaveBeenCalled();
    });

    it("fetches incidents only for matched providers, not dropped candidates", async () => {
      const { service, repository, incidentRepository, matcher } = setup();
      repository.findCandidates.mockResolvedValue([makeCandidate("akash1abc"), makeCandidate("akash1def")]);
      matcher.match.mockReturnValueOnce({ matched: true }).mockReturnValueOnce({ matched: false, error: "INSUFFICIENT_CAPACITY" });
      incidentRepository.findDailyDowntimeByProviders.mockResolvedValue([makeDowntimeRow("akash1abc", { hasOpenIncident: true })]);

      const request = makeRequest();
      const results = await service.findMatchingProviders(request);

      expect(incidentRepository.findDailyDowntimeByProviders).toHaveBeenCalledWith(["akash1abc"], request.timezone);
      expect(results).toHaveLength(1);
      expect(results[0].incidents).toEqual([{ date: "2026-06-01", hasOpenIncident: true, incidentCount: 1, downtimeSeconds: 3600 }]);
    });

    it("returns empty array without fetching candidates when the signal is already aborted", async () => {
      const { service, repository, incidentRepository, matcher } = setup();
      const controller = new AbortController();
      controller.abort();

      const results = await service.findMatchingProviders(makeRequest(), { signal: controller.signal });

      expect(results).toEqual([]);
      expect(repository.findCandidates).not.toHaveBeenCalled();
      expect(matcher.match).not.toHaveBeenCalled();
      expect(incidentRepository.findDailyDowntimeByProviders).not.toHaveBeenCalled();
    });

    it("skips matching and incidents when the signal aborts during the candidates query", async () => {
      const { service, repository, incidentRepository, matcher } = setup();
      const controller = new AbortController();
      repository.findCandidates.mockImplementation(async () => {
        controller.abort();
        return [makeCandidate("akash1abc")];
      });

      const results = await service.findMatchingProviders(makeRequest(), { signal: controller.signal });

      expect(results).toEqual([]);
      expect(matcher.match).not.toHaveBeenCalled();
      expect(incidentRepository.findDailyDowntimeByProviders).not.toHaveBeenCalled();
    });

    it("returns matched providers with empty incidents when the signal aborts during matching", async () => {
      const { service, repository, incidentRepository, matcher } = setup();
      const controller = new AbortController();
      repository.findCandidates.mockResolvedValue([makeCandidate("akash1abc")]);
      matcher.match.mockImplementation(() => {
        controller.abort();
        return { matched: true };
      });

      const results = await service.findMatchingProviders(makeRequest(), { signal: controller.signal });

      expect(results).toHaveLength(1);
      expect(results[0].owner).toBe("akash1abc");
      expect(results[0].incidents).toEqual([]);
      expect(incidentRepository.findDailyDowntimeByProviders).not.toHaveBeenCalled();
    });

    it("runs the full pipeline when a non-aborted signal is provided", async () => {
      const { service, repository, incidentRepository, matcher } = setup();
      repository.findCandidates.mockResolvedValue([makeCandidate("akash1abc")]);
      matcher.match.mockReturnValue({ matched: true });
      incidentRepository.findDailyDowntimeByProviders.mockResolvedValue([makeDowntimeRow("akash1abc", { hasOpenIncident: true })]);

      const request = makeRequest();
      const results = await service.findMatchingProviders(request, { signal: new AbortController().signal });

      expect(incidentRepository.findDailyDowntimeByProviders).toHaveBeenCalledWith(["akash1abc"], request.timezone);
      expect(results[0].incidents).toEqual([{ date: "2026-06-01", hasOpenIncident: true, incidentCount: 1, downtimeSeconds: 3600 }]);
    });

    it("keeps the existing response shape when no verification requirement is present", async () => {
      const { service, repository, matcher } = setup();
      repository.findCandidates.mockResolvedValue([makeCandidate("akash1abc")]);
      matcher.match.mockReturnValue({ matched: true });

      const result = await service.screenProviders(makeRequest());

      expect(result).toEqual({
        providers: [
          expect.objectContaining({
            owner: "akash1abc"
          })
        ]
      });
      expect(result.providers[0]).not.toHaveProperty("verification");
    });

    it("includes providers that pass verification after capacity matching", async () => {
      const { service, repository, matcher } = setup();
      repository.findCandidates.mockResolvedValue([makeCandidate("akash1abc", { verification: storedVerification() })]);
      matcher.match.mockReturnValue({ matched: true });

      const result = await service.screenProviders(
        makeRequest({
          verification: verificationRequirement({ requiredCapabilities: [CapabilityFlag.capability_persistent_storage] })
        })
      );

      expect(result.exclusions).toEqual([]);
      expect(result.providers[0].verification).toMatchObject({
        outcome: "pass",
        summary: { tierGateTier: VerificationTier.verification_tier_identified }
      });
    });

    it("requires both legacy signedBy and verification when both are present", async () => {
      const { service, repository, matcher } = setup();
      repository.findCandidates.mockResolvedValue([makeCandidate("akash1abc", { verification: storedVerification() })]);
      matcher.match.mockReturnValue({ matched: true });
      const request = makeRequest({
        signedBy: { allOf: ["akash1legacyauditor"], anyOf: [] },
        verification: verificationRequirement({ minTier: VerificationTier.verification_tier_verified })
      });

      const result = await service.screenProviders(request);

      expect(repository.findCandidates).toHaveBeenCalledWith(expect.any(Array), request.requirements);
      expect(result.providers).toEqual([]);
      expect(result.exclusions?.[0].firstFailure).toEqual({ code: "snapshot_not_posted" });
    });

    it("excludes verification failures with the first and complete failure set", async () => {
      const { service, repository, matcher } = setup();
      repository.findCandidates.mockResolvedValue([makeCandidate("akash1abc", { verification: storedVerification() })]);
      matcher.match.mockReturnValue({ matched: true });

      const result = await service.screenProviders(
        makeRequest({
          verification: verificationRequirement({
            minTier: VerificationTier.verification_tier_verified,
            requiredCapabilities: [CapabilityFlag.capability_bare_metal],
            minAuditorCount: 2
          })
        })
      );

      expect(result.providers).toEqual([]);
      expect(result.exclusions).toEqual([
        expect.objectContaining({
          owner: "akash1abc",
          firstFailure: { code: "snapshot_not_posted" },
          failures: [
            { code: "snapshot_not_posted" },
            {
              code: "insufficient_tier",
              actual: VerificationTier.verification_tier_identified,
              required: VerificationTier.verification_tier_verified
            },
            { code: "missing_capability", capability: CapabilityFlag.capability_bare_metal },
            { code: "insufficient_auditor_count", actual: 0, required: 2 }
          ]
        })
      ]);
    });

    it("fails open and marks unavailable verification facts as not evaluated", async () => {
      const { service, repository, matcher } = setup();
      repository.findCandidates.mockResolvedValue([makeCandidate("akash1abc")]);
      matcher.match.mockReturnValue({ matched: true });

      const result = await service.screenProviders(makeRequest({ verification: verificationRequirement() }));

      expect(result.exclusions).toEqual([]);
      expect(result.providers[0].verification).toEqual({
        outcome: "not_evaluated",
        incompleteFacts: ["params", "attestations", "graces"],
        summary: expect.any(Object)
      });
    });

    it("marks disabled-module screening as not evaluated without excluding the provider", async () => {
      const { service, repository, matcher } = setup();
      repository.findCandidates.mockResolvedValue([makeCandidate("akash1abc", { verification: storedVerification({ moduleActive: false, complete: false }) })]);
      matcher.match.mockReturnValue({ matched: true });

      const result = await service.screenProviders(makeRequest({ verification: verificationRequirement() }));

      expect(result.exclusions).toEqual([]);
      expect(result.providers[0].verification).toMatchObject({ outcome: "not_evaluated", incompleteFacts: ["module_inactive"] });
    });

    it("does not report capacity failures as verification exclusions", async () => {
      const { service, repository, matcher } = setup();
      repository.findCandidates.mockResolvedValue([makeCandidate("akash1abc", { verification: storedVerification() })]);
      matcher.match.mockReturnValue({ matched: false, error: "INSUFFICIENT_CAPACITY" });

      const result = await service.screenProviders(makeRequest({ verification: verificationRequirement() }));

      expect(result).toEqual({ providers: [], exclusions: [] });
    });
  });

  function setup() {
    const repository = mock<BidScreeningRepository>();
    const incidentRepository = mock<ProviderIncidentRepository>();
    incidentRepository.findDailyDowntimeByProviders.mockResolvedValue([]);
    const matcher = mock<ClusterInventoryMatcherService>();
    const logger = mock<LoggerService>();
    const service = new BidScreeningService(repository, incidentRepository, matcher, () => logger);
    return { service, repository, incidentRepository, matcher, logger };
  }
});

function makeDowntimeRow(provider: string, overrides?: Partial<DailyDowntimeRow>): DailyDowntimeRow {
  return { provider, date: "2026-06-01", hasOpenIncident: false, incidentCount: 1, downtimeSeconds: 3600, ...overrides };
}

function makeCandidate(
  owner: string,
  overrides?: {
    isAudited?: boolean;
    createdAt?: string;
    location?: string | null;
    organization?: string | null;
    verification?: StoredProviderVerification | null;
  }
): BidScreeningCandidate {
  return {
    owner,
    hostUri: "https://provider.example.com:8443",
    isAudited: overrides?.isAudited ?? false,
    createdAt: overrides?.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    verification: overrides?.verification ?? null,
    verificationObservedHeight: overrides?.verification?.facts.observedHeight ?? null,
    location: overrides?.location ?? null,
    organization: overrides?.organization ?? null,
    cluster: {
      nodes: [
        {
          name: "node1",
          cpu: { allocatable: 8000n, allocated: 0n },
          memory: { allocatable: 17179869184n, allocated: 0n },
          ephemeralStorage: { allocatable: 107374182400n, allocated: 0n },
          gpu: { quantity: { allocatable: 0n, allocated: 0n }, info: [] },
          storageClasses: ["beta2"],
          cpus: []
        }
      ],
      storage: Object.create(null)
    }
  };
}

function makeRequest(
  overrides?: Partial<{
    attributes: { key: string; value: string }[];
    signedBy: { allOf: string[]; anyOf: string[] };
    verification: VerificationRequirement;
  }>
): BidScreeningInput {
  return {
    timezone: "America/Chicago",
    requirements: {
      signedBy: overrides?.signedBy ?? { allOf: [], anyOf: [] },
      attributes: overrides?.attributes ?? [],
      verification: overrides?.verification
    },
    resources: [
      {
        resource: {
          id: 1,
          cpu: { units: { val: 1000n }, attributes: [] },
          memory: { quantity: { val: 1073741824n }, attributes: [] },
          gpu: { units: { val: 0n }, attributes: [] },
          storage: [{ name: "default", quantity: { val: 5368709120n }, attributes: [{ key: "persistent", value: "false" }] }],
          endpoints: []
        },
        count: 1,
        price: { denom: "uakt", amount: "1000" }
      }
    ]
  };
}

function verificationRequirement(overrides: Partial<VerificationRequirement> = {}): VerificationRequirement {
  return {
    minTier: VerificationTier.verification_tier_identified,
    requiredCapabilities: [],
    requiredAuditors: [],
    auditorMode: AuditorSelectionMode.auditor_selection_mode_unspecified,
    minAuditorCount: 0,
    ...overrides
  };
}

function storedVerification(input: { complete?: boolean; moduleActive?: boolean | null } = {}): StoredProviderVerification {
  const complete = input.complete ?? true;
  return {
    moduleActive: input.moduleActive ?? true,
    facts: {
      attestations: complete
        ? [
            {
              auditor: "akash1auditor",
              capabilities: [CapabilityFlag.capability_persistent_storage],
              status: AttestationStatus.attestation_status_valid,
              tier: VerificationTier.verification_tier_identified
            }
          ]
        : [],
      completeness: { attestations: complete, graces: complete, snapshot: complete },
      graces: [],
      observedAt: "2026-08-24T12:00:00.000Z",
      observedHeight: "123",
      snapshot: null
    }
  };
}
