import type { LoggerService } from "@akashnetwork/logging";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { GroupSpecJSON } from "@src/lib/groupspec-mapper/groupspec-mapper";
import type { ProviderInventoryRepository } from "@src/repositories/provider-inventory/provider-inventory.repository";
import type { ProviderWithSnapshot } from "../../types/provider";
import type { ClusterInventoryMatcherService } from "../cluster-inventory-matcher/cluster-inventory-matcher.service";
import { BidScreeningService } from "./bid-screening.service";

describe(BidScreeningService.name, () => {
  describe("findMatchingProviders", () => {
    it("returns passing providers with metadata", async () => {
      const { service, repository, matcher } = setup();
      repository.getOnlineProvidersWithSnapshots.mockResolvedValue([makeProvider("akash1abc")]);
      repository.getAuditedProviderAddresses.mockResolvedValue(new Set());
      matcher.match.mockReturnValue({ matched: true });

      const results = await service.findMatchingProviders(makeRequest());

      expect(results).toEqual([
        {
          owner: "akash1abc",
          hostUri: "https://provider.example.com:8443",
          region: "us-east",
          uptime7d: 0.998,
          isAudited: false
        }
      ]);
    });

    it("filters out providers that fail matching", async () => {
      const { service, repository, matcher } = setup();
      repository.getOnlineProvidersWithSnapshots.mockResolvedValue([makeProvider("akash1abc"), makeProvider("akash1def")]);
      repository.getAuditedProviderAddresses.mockResolvedValue(new Set());
      matcher.match.mockReturnValueOnce({ matched: true }).mockReturnValueOnce({ matched: false, error: "INSUFFICIENT_CAPACITY" });

      const results = await service.findMatchingProviders(makeRequest());

      expect(results).toHaveLength(1);
      expect(results[0].owner).toBe("akash1abc");
    });

    it("returns empty array when no providers are online", async () => {
      const { service, repository } = setup();
      repository.getOnlineProvidersWithSnapshots.mockResolvedValue([]);
      repository.getAuditedProviderAddresses.mockResolvedValue(new Set());

      const results = await service.findMatchingProviders(makeRequest());

      expect(results).toEqual([]);
    });

    it("returns empty array when all providers fail matching", async () => {
      const { service, repository, matcher } = setup();
      repository.getOnlineProvidersWithSnapshots.mockResolvedValue([makeProvider("akash1abc")]);
      repository.getAuditedProviderAddresses.mockResolvedValue(new Set());
      matcher.match.mockReturnValue({ matched: false, error: "INSUFFICIENT_CAPACITY" });

      const results = await service.findMatchingProviders(makeRequest());

      expect(results).toEqual([]);
    });
  });

  describe("filtering", () => {
    it("loads providers and audited owners in parallel after pre-filter", async () => {
      const { service, repository, matcher } = setup();
      repository.getOnlineProvidersWithSnapshots.mockResolvedValue([makeProvider("akash1abc")]);
      repository.getAuditedProviderAddresses.mockResolvedValue(new Set());
      matcher.match.mockReturnValue({ matched: true });

      await service.findMatchingProviders(makeRequest());

      expect(repository.getOnlineProvidersWithSnapshots).toHaveBeenCalledTimes(1);
      expect(repository.getAuditedProviderAddresses).toHaveBeenCalledTimes(1);
    });

    it("enriches isAudited=true for providers with matching auditor signatures", async () => {
      const { service, repository, matcher } = setup();
      repository.getOnlineProvidersWithSnapshots.mockResolvedValue([makeProvider("akash1abc"), makeProvider("akash1def")]);
      repository.getAuditedProviderAddresses.mockResolvedValue(new Set(["akash1abc"]));
      matcher.match.mockReturnValue({ matched: true });

      const results = await service.findMatchingProviders(makeRequest());

      expect(results).toHaveLength(2);
      expect(results.find(r => r.owner === "akash1abc")?.isAudited).toBe(true);
      expect(results.find(r => r.owner === "akash1def")?.isAudited).toBe(false);
    });
  });

  function setup() {
    const repository = mock<ProviderInventoryRepository>();
    const matcher = mock<ClusterInventoryMatcherService>();
    const logger = mock<LoggerService>();
    const service = new BidScreeningService(repository, matcher, logger);
    return { service, repository, matcher, logger };
  }
});

function makeProvider(owner: string, hostUri = "https://provider.example.com:8443"): ProviderWithSnapshot {
  return {
    owner,
    hostUri,
    ipRegion: "us-east",
    uptime7d: 0.998,
    lastSuccessfulSnapshot: {
      nodes: [
        {
          name: "node1",
          cpuAllocatable: 8000,
          cpuAllocated: 0,
          memoryAllocatable: 17179869184,
          memoryAllocated: 0,
          ephemeralStorageAllocatable: 107374182400,
          ephemeralStorageAllocated: 0,
          gpuAllocatable: 0,
          gpuAllocated: 0,
          capabilitiesStorageHDD: false,
          capabilitiesStorageSSD: true,
          capabilitiesStorageNVME: false,
          gpus: [],
          cpus: []
        }
      ],
      storage: []
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
          cpu: { units: { val: "1000" }, attributes: [] },
          memory: { quantity: { val: "1073741824" }, attributes: [] },
          gpu: { units: { val: "0" }, attributes: [] },
          storage: [{ name: "default", quantity: { val: "5368709120" }, attributes: [{ key: "persistent", value: "false" }] }],
          endpoints: []
        },
        count: 1,
        price: { denom: "uakt", amount: "1000" }
      }
    ]
  };
}
