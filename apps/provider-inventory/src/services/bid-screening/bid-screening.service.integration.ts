import type postgres from "postgres";
import { container, Lifecycle } from "tsyringe";
import { beforeEach, describe, expect, it } from "vitest";

import type { EnvConfig } from "@src/config/env.config";
import type { GroupSpecJSON } from "@src/lib/groupspec-mapper/groupspec-mapper";
import { APP_CONFIG } from "@src/providers/app-config.provider";
import { LoggerService } from "@src/providers/logging.provider";
import { PG_CLIENT } from "@src/providers/postgres.provider";
import { BidScreeningRepository } from "@src/repositories/bid-screening/bid-screening.repository";
import { BidScreeningService } from "@src/services/bid-screening/bid-screening.service";
import { ClusterInventoryMatcherService } from "@src/services/cluster-inventory-matcher/cluster-inventory-matcher.service";
import type { Inventory } from "@src/types/inventory";

import { testDb } from "@test/setup-integration-tests";

const AUDITOR = "akash1auditor";

describe(BidScreeningService.name, () => {
  beforeEach(async () => {
    await testDb.truncate();
  });

  describe("findMatchingProviders", () => {
    it("returns providers that match the SQL prefilter and the bin-packer", async () => {
      const { service } = setup();
      await seedProvider({
        owner: "fits",
        totalAvailableCpu: 8000n,
        totalAvailableMemory: 17179869184n,
        totalAvailableEph: 107374182400n,
        maxNodeFreeCpu: 8000n,
        maxNodeFreeMemory: 17179869184n,
        inventory: singleNodeInventory({ cpu: 8000, memory: 17179869184, eph: 107374182400 })
      });
      await seedProvider({
        owner: "too-small",
        totalAvailableCpu: 100n,
        maxNodeFreeCpu: 100n,
        inventory: singleNodeInventory({ cpu: 100, memory: 100, eph: 100 })
      });

      const results = await service.findMatchingProviders(makeRequest({ cpu: 1000n, memory: 1073741824n, eph: 5368709120n }));

      expect(results.map(r => r.owner).sort()).toEqual(["fits"]);
    });

    it("excludes providers the SQL prefilter rejects even if the bin-packer would otherwise fit", async () => {
      const { service } = setup();
      await seedProvider({
        owner: "rolled-up-low",
        totalAvailableCpu: 100n,
        maxNodeFreeCpu: 100n,
        inventory: singleNodeInventory({ cpu: 8000, memory: 17179869184, eph: 107374182400 })
      });

      const results = await service.findMatchingProviders(makeRequest({ cpu: 1000n, memory: 1073741824n, eph: 5368709120n }));

      expect(results).toEqual([]);
    });

    it("excludes providers that pass SQL prefilter but fail bin-packing across nodes", async () => {
      const { service } = setup();
      await seedProvider({
        owner: "tight-fit-fragmented",
        totalAvailableCpu: 10000n,
        totalAvailableMemory: 17179869184n,
        totalAvailableEph: 107374182400n,
        maxNodeFreeCpu: 4000n,
        maxNodeFreeMemory: 17179869184n,
        inventory: {
          nodes: [
            { name: "n1", cpu: { available: 4000 }, memory: { available: 8589934592 }, ephStorage: { available: 53687091200 }, gpu: [], persistentStorage: [] },
            { name: "n2", cpu: { available: 4000 }, memory: { available: 8589934592 }, ephStorage: { available: 53687091200 }, gpu: [], persistentStorage: [] }
          ],
          storage: []
        }
      });

      const results = await service.findMatchingProviders(makeRequest({ cpu: 5000n, memory: 1073741824n, eph: 5368709120n }));

      expect(results).toEqual([]);
    });

    it("returns isAudited=true for providers signed by the configured AUDITOR_ADDRESS", async () => {
      const { service } = setup();
      await seedProvider({
        owner: "audited",
        auditedBy: [AUDITOR],
        totalAvailableCpu: 8000n,
        totalAvailableMemory: 17179869184n,
        totalAvailableEph: 107374182400n,
        maxNodeFreeCpu: 8000n,
        maxNodeFreeMemory: 17179869184n,
        inventory: singleNodeInventory({ cpu: 8000, memory: 17179869184, eph: 107374182400 })
      });
      await seedProvider({
        owner: "not-audited",
        auditedBy: ["other-auditor"],
        totalAvailableCpu: 8000n,
        totalAvailableMemory: 17179869184n,
        totalAvailableEph: 107374182400n,
        maxNodeFreeCpu: 8000n,
        maxNodeFreeMemory: 17179869184n,
        inventory: singleNodeInventory({ cpu: 8000, memory: 17179869184, eph: 107374182400 })
      });

      const results = await service.findMatchingProviders(makeRequest({ cpu: 1000n, memory: 1073741824n, eph: 5368709120n }));

      const byOwner = new Map(results.map(r => [r.owner, r]));
      expect(byOwner.get("audited")?.isAudited).toBe(true);
      expect(byOwner.get("not-audited")?.isAudited).toBe(false);
    });

    it("returns metadata fields (hostUri, region, uptime7d) from the provider_inventory row", async () => {
      const { service } = setup();
      await seedProvider({
        owner: "with-meta",
        hostUri: "https://provider.example.com:8443",
        ipRegion: "us-east",
        uptime7d: 0.998,
        totalAvailableCpu: 8000n,
        totalAvailableMemory: 17179869184n,
        totalAvailableEph: 107374182400n,
        maxNodeFreeCpu: 8000n,
        maxNodeFreeMemory: 17179869184n,
        inventory: singleNodeInventory({ cpu: 8000, memory: 17179869184, eph: 107374182400 })
      });

      const [result] = await service.findMatchingProviders(makeRequest({ cpu: 1000n, memory: 1073741824n, eph: 5368709120n }));

      expect(result).toEqual({
        owner: "with-meta",
        hostUri: "https://provider.example.com:8443",
        region: "us-east",
        uptime7d: 0.998,
        isAudited: false
      });
    });

    it("ignores offline providers and providers without is_online_since", async () => {
      const { service } = setup();
      await seedProvider({
        owner: "online-ok",
        isOnline: true,
        isOnlineSince: new Date(),
        totalAvailableCpu: 8000n,
        totalAvailableMemory: 17179869184n,
        totalAvailableEph: 107374182400n,
        maxNodeFreeCpu: 8000n,
        maxNodeFreeMemory: 17179869184n,
        inventory: singleNodeInventory({ cpu: 8000, memory: 17179869184, eph: 107374182400 })
      });
      await seedProvider({
        owner: "offline",
        isOnline: false,
        totalAvailableCpu: 8000n,
        maxNodeFreeCpu: 8000n,
        inventory: singleNodeInventory({ cpu: 8000, memory: 17179869184, eph: 107374182400 })
      });
      await seedProvider({
        owner: "stale",
        isOnline: true,
        isOnlineSince: null,
        totalAvailableCpu: 8000n,
        maxNodeFreeCpu: 8000n,
        inventory: singleNodeInventory({ cpu: 8000, memory: 17179869184, eph: 107374182400 })
      });

      const results = await service.findMatchingProviders(makeRequest({ cpu: 1000n, memory: 1073741824n, eph: 5368709120n }));

      expect(results.map(r => r.owner)).toEqual(["online-ok"]);
    });

    it("filters by self-attribute exact and glob requirements", async () => {
      const { service } = setup();
      await seedProvider({
        owner: "us-east",
        selfAttributes: [{ key: "region", value: "us-east-1" }],
        totalAvailableCpu: 8000n,
        totalAvailableMemory: 17179869184n,
        totalAvailableEph: 107374182400n,
        maxNodeFreeCpu: 8000n,
        maxNodeFreeMemory: 17179869184n,
        inventory: singleNodeInventory({ cpu: 8000, memory: 17179869184, eph: 107374182400 })
      });
      await seedProvider({
        owner: "eu-west",
        selfAttributes: [{ key: "region", value: "eu-west-1" }],
        totalAvailableCpu: 8000n,
        totalAvailableMemory: 17179869184n,
        totalAvailableEph: 107374182400n,
        maxNodeFreeCpu: 8000n,
        maxNodeFreeMemory: 17179869184n,
        inventory: singleNodeInventory({ cpu: 8000, memory: 17179869184, eph: 107374182400 })
      });

      const glob = await service.findMatchingProviders(
        makeRequest({ cpu: 1000n, memory: 1073741824n, eph: 5368709120n, attributes: [{ key: "region", value: "us-*" }] })
      );
      const exact = await service.findMatchingProviders(
        makeRequest({ cpu: 1000n, memory: 1073741824n, eph: 5368709120n, attributes: [{ key: "region", value: "eu-west-1" }] })
      );

      expect(glob.map(r => r.owner)).toEqual(["us-east"]);
      expect(exact.map(r => r.owner)).toEqual(["eu-west"]);
    });

    it("filters by signedBy.allOf so only providers signed by every listed auditor pass", async () => {
      const { service } = setup();
      await seedProvider({
        owner: "by-both",
        auditedBy: ["auditor-a", "auditor-b"],
        totalAvailableCpu: 8000n,
        totalAvailableMemory: 17179869184n,
        totalAvailableEph: 107374182400n,
        maxNodeFreeCpu: 8000n,
        maxNodeFreeMemory: 17179869184n,
        inventory: singleNodeInventory({ cpu: 8000, memory: 17179869184, eph: 107374182400 })
      });
      await seedProvider({
        owner: "by-a-only",
        auditedBy: ["auditor-a"],
        totalAvailableCpu: 8000n,
        totalAvailableMemory: 17179869184n,
        totalAvailableEph: 107374182400n,
        maxNodeFreeCpu: 8000n,
        maxNodeFreeMemory: 17179869184n,
        inventory: singleNodeInventory({ cpu: 8000, memory: 17179869184, eph: 107374182400 })
      });

      const results = await service.findMatchingProviders(
        makeRequest({ cpu: 1000n, memory: 1073741824n, eph: 5368709120n, signedBy: { allOf: ["auditor-a", "auditor-b"], anyOf: [] } })
      );

      expect(results.map(r => r.owner)).toEqual(["by-both"]);
    });
  });

  describe("request validation", () => {
    it("rejects persistent storage without a class", async () => {
      const { service } = setup();
      const request = makeRequest({ cpu: 1000n, memory: 1073741824n, eph: 0n });
      request.resources[0].resource.storage = [
        {
          name: "data",
          quantity: { val: "1073741824" },
          attributes: [{ key: "persistent", value: "true" }]
        }
      ];

      await expect(service.findMatchingProviders(request)).rejects.toThrow(/must specify a valid storage class/);
    });

    it("rejects persistent storage with class=ram", async () => {
      const { service } = setup();
      const request = makeRequest({ cpu: 1000n, memory: 1073741824n, eph: 0n });
      request.resources[0].resource.storage = [
        {
          name: "data",
          quantity: { val: "1073741824" },
          attributes: [
            { key: "persistent", value: "true" },
            { key: "class", value: "ram" }
          ]
        }
      ];

      await expect(service.findMatchingProviders(request)).rejects.toThrow(/must specify a valid storage class/);
    });
  });

  function setup() {
    const testContainer = container.createChildContainer();
    testContainer.register(APP_CONFIG, { useValue: { AUDITOR_ADDRESS: AUDITOR } as EnvConfig });
    testContainer.register(BidScreeningRepository, { useClass: BidScreeningRepository }, { lifecycle: Lifecycle.ContainerScoped });
    testContainer.register(ClusterInventoryMatcherService, { useClass: ClusterInventoryMatcherService }, { lifecycle: Lifecycle.ContainerScoped });
    testContainer.register(LoggerService, { useClass: LoggerService }, { lifecycle: Lifecycle.ContainerScoped });
    testContainer.register(BidScreeningService, { useClass: BidScreeningService }, { lifecycle: Lifecycle.ContainerScoped });

    const service = testContainer.resolve(BidScreeningService);
    return { service };
  }
});

interface SeedInput {
  owner: string;
  hostUri?: string;
  ipRegion?: string | null;
  uptime7d?: number | null;
  isOnline?: boolean;
  isOnlineSince?: Date | null;
  totalAvailableCpu?: bigint;
  totalAvailableMemory?: bigint;
  totalAvailableGpu?: bigint;
  totalAvailableEph?: bigint;
  totalAvailablePersistent?: bigint;
  maxNodeFreeCpu?: bigint;
  maxNodeFreeMemory?: bigint;
  maxNodeFreeGpu?: bigint;
  gpuModels?: string[];
  storageClasses?: string[];
  selfAttributes?: { key: string; value: string }[];
  signedAttributes?: { key: string; value: string; auditor: string }[];
  auditedBy?: string[];
  inventory?: Inventory;
}

async function seedProvider(input: SeedInput): Promise<void> {
  const pg = container.resolve(PG_CLIENT);
  await pg.unsafe(
    `
      INSERT INTO provider_inventory (
        owner, host_uri, created_height, ip_region, uptime_7d,
        is_online, is_online_since, inventory,
        total_available_cpu, total_available_memory, total_available_gpu,
        total_available_eph, total_available_persistent,
        max_node_free_cpu, max_node_free_memory, max_node_free_gpu,
        gpu_models, storage_classes, self_attributes, signed_attributes, audited_by
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8::jsonb,
        $9::bigint, $10::bigint, $11::bigint,
        $12::bigint, $13::bigint,
        $14::bigint, $15::bigint, $16::bigint,
        $17::text[], $18::text[], $19::jsonb, $20::jsonb, $21::text[]
      )
    `,
    [
      input.owner,
      input.hostUri ?? `https://${input.owner}.example:8443`,
      "100",
      input.ipRegion ?? null,
      input.uptime7d ?? null,
      input.isOnline ?? true,
      input.isOnlineSince === undefined ? new Date() : input.isOnlineSince,
      JSON.stringify(input.inventory ?? { nodes: [], storage: [] }),
      (input.totalAvailableCpu ?? 0n).toString(),
      (input.totalAvailableMemory ?? 0n).toString(),
      (input.totalAvailableGpu ?? 0n).toString(),
      (input.totalAvailableEph ?? 0n).toString(),
      (input.totalAvailablePersistent ?? 0n).toString(),
      (input.maxNodeFreeCpu ?? 0n).toString(),
      (input.maxNodeFreeMemory ?? 0n).toString(),
      (input.maxNodeFreeGpu ?? 0n).toString(),
      input.gpuModels ?? [],
      input.storageClasses ?? [],
      JSON.stringify(input.selfAttributes ?? []),
      JSON.stringify(input.signedAttributes ?? []),
      input.auditedBy ?? []
    ] as postgres.ParameterOrJSON<never>[]
  );
}

function singleNodeInventory(input: { cpu: number; memory: number; eph: number }): Inventory {
  return {
    nodes: [
      {
        name: "n1",
        cpu: { available: input.cpu },
        memory: { available: input.memory },
        ephStorage: { available: input.eph },
        gpu: [],
        persistentStorage: []
      }
    ],
    storage: []
  };
}

function makeRequest(overrides: {
  cpu: bigint;
  memory: bigint;
  eph: bigint;
  attributes?: { key: string; value: string }[];
  signedBy?: { allOf: string[]; anyOf: string[] };
}): GroupSpecJSON {
  return {
    name: "westcoast",
    requirements: {
      signedBy: overrides.signedBy ?? { allOf: [], anyOf: [] },
      attributes: overrides.attributes ?? []
    },
    resources: [
      {
        resource: {
          id: 1,
          cpu: { units: { val: overrides.cpu.toString() }, attributes: [] },
          memory: { quantity: { val: overrides.memory.toString() }, attributes: [] },
          gpu: { units: { val: "0" }, attributes: [] },
          storage: [{ name: "default", quantity: { val: overrides.eph.toString() }, attributes: [{ key: "persistent", value: "false" }] }],
          endpoints: []
        },
        count: 1,
        price: { denom: "uakt", amount: "1000" }
      }
    ]
  };
}
