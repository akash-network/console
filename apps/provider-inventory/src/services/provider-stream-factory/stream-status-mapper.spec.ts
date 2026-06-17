import type {
  Cluster,
  CPUInfo,
  GPU,
  GPUInfo,
  Inventory,
  Node as SdkNode,
  NodeCapabilities,
  ResourcePair as SdkResourcePair,
  Status as ProviderStatus,
  Storage as SdkStorage,
  StorageInfo
} from "@akashnetwork/chain-sdk/private-types/provider.akash.v1";
import { describe, expect, it } from "vitest";

import { mapProviderStatusToClusterState, parseQuantity } from "./stream-status-mapper";

describe(parseQuantity.name, () => {
  describe("empty / unparseable input", () => {
    it("returns 0n when the quantity is undefined", () => {
      expect(parseQuantity(undefined)).toBe(0n);
    });

    it("returns 0n when the string is empty", () => {
      expect(parseQuantity({ string: "" })).toBe(0n);
    });

    it("returns 0n when the string is whitespace", () => {
      expect(parseQuantity({ string: "   " })).toBe(0n);
    });

    it("returns 0n on garbage input", () => {
      expect(parseQuantity({ string: "abc" })).toBe(0n);
    });
  });

  describe("integer mantissa with binary SI suffix", () => {
    it("parses 1Ki as 2^10", () => {
      expect(parseQuantity({ string: "1Ki" })).toBe(1024n);
    });

    it("parses 32Gi as 32 * 2^30", () => {
      expect(parseQuantity({ string: "32Gi" })).toBe(34359738368n);
    });

    it("preserves precision for 1Ei (2^60 exceeds Number.MAX_SAFE_INTEGER)", () => {
      expect(parseQuantity({ string: "1Ei" })).toBe(1n << 60n);
    });

    it("preserves precision for 1000Ei", () => {
      expect(parseQuantity({ string: "1000Ei" })).toBe(1000n * (1n << 60n));
    });

    it("preserves precision for 1Pi (2^50 already exceeds safe integer scale)", () => {
      expect(parseQuantity({ string: "1Pi" })).toBe(1n << 50n);
    });
  });

  describe("fractional mantissa with binary SI suffix", () => {
    it("parses 1.5Gi exactly", () => {
      expect(parseQuantity({ string: "1.5Gi" })).toBe(1610612736n);
    });

    it("truncates fractional results toward zero", () => {
      expect(parseQuantity({ string: "1.5Ki" })).toBe(1536n);
    });

    it("preserves precision for 1.5Ei", () => {
      expect(parseQuantity({ string: "1.5Ei" })).toBe((15n * (1n << 60n)) / 10n);
    });
  });

  describe("integer mantissa with decimal SI suffix", () => {
    it("parses '8' (no suffix) as 8n", () => {
      expect(parseQuantity({ string: "8" })).toBe(8n);
    });

    it("parses 1k as 1000", () => {
      expect(parseQuantity({ string: "1k" })).toBe(1000n);
    });

    it("parses 1M as 1e6", () => {
      expect(parseQuantity({ string: "1M" })).toBe(1_000_000n);
    });

    it("parses 1E as 1e18 (exceeds Number.MAX_SAFE_INTEGER)", () => {
      expect(parseQuantity({ string: "1E" })).toBe(10n ** 18n);
    });

    it("preserves precision for 1000E (1e21)", () => {
      expect(parseQuantity({ string: "1000E" })).toBe(10n ** 21n);
    });

    it("parses 8000m as 8 (8000 * 1e-3, truncated)", () => {
      expect(parseQuantity({ string: "8000m" })).toBe(8n);
    });

    it("truncates 500m to 0", () => {
      expect(parseQuantity({ string: "500m" })).toBe(0n);
    });
  });

  describe("decimal-exponent form", () => {
    it("parses 1e9 as 1000000000", () => {
      expect(parseQuantity({ string: "1e9" })).toBe(1_000_000_000n);
    });

    it("parses 1.5e3 as 1500", () => {
      expect(parseQuantity({ string: "1.5e3" })).toBe(1500n);
    });

    it("preserves precision for 1e21", () => {
      expect(parseQuantity({ string: "1e21" })).toBe(10n ** 21n);
    });

    it("truncates a negative exponent toward zero", () => {
      expect(parseQuantity({ string: "5e-3" })).toBe(0n);
    });
  });

  describe("signed values", () => {
    it("parses negative integers", () => {
      expect(parseQuantity({ string: "-100" })).toBe(-100n);
    });

    it("parses negative binary SI", () => {
      expect(parseQuantity({ string: "-1Ki" })).toBe(-1024n);
    });

    it("parses negative fractional binary SI exactly", () => {
      expect(parseQuantity({ string: "-1.5Gi" })).toBe(-1610612736n);
    });
  });

  describe("plain integer mantissa (no suffix)", () => {
    it("parses unsafe integers exactly", () => {
      const unsafe = 9007199254740993n;
      expect(parseQuantity({ string: unsafe.toString() })).toBe(unsafe);
    });
  });

  describe("with multiplier (pre-truncation scaling)", () => {
    it("scales 500m to 500 with multiplier 1000n", () => {
      expect(parseQuantity({ string: "500m" }, 1000n)).toBe(500n);
    });

    it("scales 1500m to 1500 with multiplier 1000n", () => {
      expect(parseQuantity({ string: "1500m" }, 1000n)).toBe(1500n);
    });

    it("scales integer cores to millicores with multiplier 1000n", () => {
      expect(parseQuantity({ string: "2" }, 1000n)).toBe(2000n);
    });

    it("scales fractional cores to millicores with multiplier 1000n", () => {
      expect(parseQuantity({ string: "0.5" }, 1000n)).toBe(500n);
    });

    it("scales binary fractional values before truncation", () => {
      expect(parseQuantity({ string: "1.5Ki" }, 1000n)).toBe(1536000n);
    });

    it("scales negative millicore values", () => {
      expect(parseQuantity({ string: "-500m" }, 1000n)).toBe(-500n);
    });

    it("scales decimal-exponent millicore equivalents", () => {
      expect(parseQuantity({ string: "5e-3" }, 1000n)).toBe(5n);
    });
  });
});

describe(mapProviderStatusToClusterState.name, () => {
  describe("nodes", () => {
    it("returns undefined nodes when the cluster is missing", () => {
      const result = mapProviderStatusToClusterState(buildStatus({ cluster: undefined }));

      expect(result.nodes).toBeUndefined();
    });

    it("maps every node in the cluster", () => {
      const inventory = buildStatus({
        cluster: buildCluster({ nodes: [buildNode({ name: "node-a" }), buildNode({ name: "node-b" })] })
      });

      const result = mapProviderStatusToClusterState(inventory);

      expect(result.nodes?.map(node => node.name)).toEqual(["node-a", "node-b"]);
    });

    it("scales cpu quantities to millicores via the 1000n multiplier", () => {
      const inventory = buildStatus({
        cluster: buildCluster({ nodes: [buildNode({ cpu: buildPair({ allocatable: "2", allocated: "1.5" }) })] })
      });

      const result = mapProviderStatusToClusterState(inventory);

      expect(result.nodes?.[0].cpu).toEqual({ allocatable: 2000n, allocated: 1500n });
    });

    it("maps memory and ephemeral storage without scaling", () => {
      const inventory = buildStatus({
        cluster: buildCluster({
          nodes: [
            buildNode({
              memory: buildPair({ allocatable: "32Gi", allocated: "1Gi" }),
              ephemeralStorage: buildPair({ allocatable: "100Gi", allocated: "0" })
            })
          ]
        })
      });

      const result = mapProviderStatusToClusterState(inventory);

      expect(result.nodes?.[0].memory).toEqual({ allocatable: 34359738368n, allocated: 1073741824n });
      expect(result.nodes?.[0].ephemeralStorage).toEqual({ allocatable: 107374182400n, allocated: 0n });
    });

    it("maps the gpu quantity pair and info", () => {
      const inventory = buildStatus({
        cluster: buildCluster({
          nodes: [
            buildNode({
              gpu: buildGpu({
                allocatable: "4",
                allocated: "1",
                info: [
                  {
                    vendor: "nvidia",
                    vendorId: "10de",
                    name: "a100",
                    modelid: "20b0",
                    interface: "pcie",
                    memorySize: "40Gi"
                  }
                ]
              })
            })
          ]
        })
      });

      const result = mapProviderStatusToClusterState(inventory);

      expect(result.nodes?.[0].gpu).toEqual({
        quantity: { allocatable: 4n, allocated: 1n },
        info: [{ vendor: "nvidia", name: "a100", modelId: "20b0", interface: "pcie", memorySize: "40Gi" }]
      });
    });

    it("defaults gpu info to an empty array when absent", () => {
      const inventory = buildStatus({
        cluster: buildCluster({ nodes: [buildNode({ gpu: buildGpu({ info: undefined }) })] })
      });

      const result = mapProviderStatusToClusterState(inventory);

      expect(result.nodes?.[0].gpu.info).toEqual([]);
    });

    it("maps cpu info entries", () => {
      const inventory = buildStatus({
        cluster: buildCluster({
          nodes: [buildNode({ cpus: [{ vendor: "amd", model: "epyc" } as CPUInfo] })]
        })
      });

      const result = mapProviderStatusToClusterState(inventory);

      expect(result.nodes?.[0].cpus).toEqual([{ vendor: "amd", model: "epyc" }]);
    });

    it("defaults cpu info to an empty array when absent", () => {
      const inventory = buildStatus({
        cluster: buildCluster({ nodes: [buildNode({ cpus: undefined })] })
      });

      const result = mapProviderStatusToClusterState(inventory);

      expect(result.nodes?.[0].cpus).toEqual([]);
    });

    it("maps the node storage classes", () => {
      const inventory = buildStatus({
        cluster: buildCluster({ nodes: [buildNode({ storageClasses: ["beta2", "beta3"] })] })
      });

      const result = mapProviderStatusToClusterState(inventory);

      expect(result.nodes?.[0].storageClasses).toEqual(["beta2", "beta3"]);
    });

    it("defaults storage classes to an empty array when capabilities are missing", () => {
      const inventory = buildStatus({
        cluster: buildCluster({ nodes: [buildNode({ capabilities: undefined })] })
      });

      const result = mapProviderStatusToClusterState(inventory);

      expect(result.nodes?.[0].storageClasses).toEqual([]);
    });
  });

  describe("storage", () => {
    it("returns undefined when the cluster is missing", () => {
      const result = mapProviderStatusToClusterState(buildStatus({ cluster: undefined }));

      expect(result.storage).toBeUndefined();
    });

    it("returns undefined when the cluster has no storage", () => {
      const result = mapProviderStatusToClusterState(buildStatus({ cluster: buildCluster({ storage: undefined }) }));

      expect(result.storage).toBeUndefined();
    });

    it("keys each pool by its storage class", () => {
      const inventory = buildStatus({
        cluster: buildCluster({
          storage: [
            buildStorage({ class: "beta2", allocatable: "100Gi", allocated: "10Gi" }),
            buildStorage({ class: "beta3", allocatable: "200Gi", allocated: "0" })
          ]
        })
      });

      const result = mapProviderStatusToClusterState(inventory);

      expect(result.storage).toEqual({
        beta2: { class: "beta2", quantity: { allocatable: 107374182400n, allocated: 10737418240n } },
        beta3: { class: "beta3", quantity: { allocatable: 214748364800n, allocated: 0n } }
      });
    });

    it("falls back to an empty-string class when the pool info is missing", () => {
      const inventory = buildStatus({
        cluster: buildCluster({ storage: [buildStorage({ class: undefined, allocatable: "50Gi", allocated: "0" })] })
      });

      const result = mapProviderStatusToClusterState(inventory);

      expect(result.storage?.[""]).toEqual({ class: "", quantity: { allocatable: 53687091200n, allocated: 0n } });
    });
  });

  describe("leasedIp", () => {
    it("maps the leased ip pair", () => {
      const inventory = buildStatus({ leasedIp: buildPair({ allocatable: "10", allocated: "3" }) });

      const result = mapProviderStatusToClusterState(inventory);

      expect(result.leasedIp).toEqual({ allocatable: 10n, allocated: 3n });
    });

    it("defaults to a zero pair when leasedIp is missing", () => {
      const result = mapProviderStatusToClusterState(buildStatus({ leasedIp: undefined }));

      expect(result.leasedIp).toEqual({ allocatable: 0n, allocated: 0n });
    });
  });

  function buildStatus(overrides: Partial<Inventory>): ProviderStatus {
    return { cluster: { inventory: { cluster: undefined, leasedIp: undefined, ...overrides } } } as ProviderStatus;
  }

  function buildCluster(overrides: { nodes?: SdkNode[]; storage?: SdkStorage[] }): Cluster {
    return { nodes: overrides.nodes ?? [], storage: overrides.storage } as Cluster;
  }

  function buildPair(input: { allocatable?: string; allocated?: string }) {
    return { allocatable: { string: input.allocatable }, allocated: { string: input.allocated } } as SdkResourcePair;
  }

  function buildGpu(input: { allocatable?: string; allocated?: string; info?: GPUInfo[] }) {
    return { quantity: buildPair(input), info: input.info } as GPU;
  }

  function buildStorage(input: { class?: string; allocatable?: string; allocated?: string }) {
    return { quantity: buildPair(input), info: input.class === undefined ? undefined : ({ class: input.class } as StorageInfo) } as SdkStorage;
  }

  function buildNode(
    input: {
      name?: string;
      cpu?: SdkResourcePair;
      memory?: SdkResourcePair;
      ephemeralStorage?: SdkResourcePair;
      gpu?: GPU;
      cpus?: CPUInfo[];
      storageClasses?: string[];
      capabilities?: NodeCapabilities;
    } = {}
  ) {
    return {
      name: input.name ?? "node-1",
      resources: {
        cpu: { quantity: input.cpu ?? buildPair({ allocatable: "1", allocated: "0" }), info: input.cpus ?? [] },
        memory: { quantity: input.memory ?? buildPair({ allocatable: "1Gi", allocated: "0" }) },
        ephemeralStorage: input.ephemeralStorage ?? buildPair({ allocatable: "1Gi", allocated: "0" }),
        gpu: input.gpu ?? buildGpu({ allocatable: "0", allocated: "0", info: [] })
      },
      capabilities: "capabilities" in input ? input.capabilities : { storageClasses: input.storageClasses ?? [] }
    } as SdkNode;
  }
});
