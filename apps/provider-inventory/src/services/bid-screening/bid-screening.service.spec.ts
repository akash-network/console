import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { GroupSpecJSON } from "@src/mappers/groupspec-mapper/groupspec-mapper";
import type { BidScreeningCandidate, BidScreeningRepository } from "@src/repositories/bid-screening/bid-screening.repository";
import type { ClusterInventoryMatcherService } from "../cluster-inventory-matcher/cluster-inventory-matcher.service";
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
          createdAt: "2026-01-01T00:00:00.000Z"
        }
      ]);
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
  });

  function setup() {
    const repository = mock<BidScreeningRepository>();
    const matcher = mock<ClusterInventoryMatcherService>();
    const service = new BidScreeningService(repository, matcher);
    return { service, repository, matcher };
  }
});

function makeCandidate(owner: string, overrides?: { isAudited?: boolean; createdAt?: string }): BidScreeningCandidate {
  return {
    owner,
    hostUri: "https://provider.example.com:8443",
    isAudited: overrides?.isAudited ?? false,
    createdAt: overrides?.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
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
  }>
): GroupSpecJSON {
  return {
    name: "westcoast",
    requirements: {
      signedBy: overrides?.signedBy ?? { allOf: [], anyOf: [] },
      attributes: overrides?.attributes ?? []
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
