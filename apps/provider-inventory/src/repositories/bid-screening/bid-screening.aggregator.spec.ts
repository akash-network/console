import { describe, expect, it } from "vitest";

import { parseGPUAttributes } from "@src/mappers/gpu-attribute-parser/gpu-attribute-parser";
import type { GroupSpecJSON } from "@src/mappers/groupspec-mapper/groupspec-mapper";
import { parseStorageAttributes } from "@src/mappers/storage-attribute-parser/storage-attribute-parser";
import type { RequestedResourceUnit, ResourceAttribute } from "@src/types/inventory";
import { aggregateCriteria } from "./bid-screening.aggregator";

interface RawStorageVolume {
  name: string;
  quantity: bigint;
  attributes: ResourceAttribute[];
}

describe(aggregateCriteria.name, () => {
  describe("totals", () => {
    it("multiplies single-unit cpu/memory/gpu by count", () => {
      const c = aggregateCriteria([makeUnit({ cpu: 1000n, memory: 2_000_000n, gpu: 1n, count: 3 })], makeRequirements());
      expect(c.totalCpu).toBe(3000n);
      expect(c.totalMemory).toBe(6_000_000n);
      expect(c.totalGpu).toBe(3n);
    });

    it("sums across multiple units", () => {
      const c = aggregateCriteria(
        [makeUnit({ cpu: 1000n, memory: 1_000_000n, gpu: 0n, count: 2 }), makeUnit({ cpu: 500n, memory: 2_000_000n, gpu: 1n, count: 4 })],
        makeRequirements()
      );
      expect(c.totalCpu).toBe(1000n * 2n + 500n * 4n);
      expect(c.totalMemory).toBe(1_000_000n * 2n + 2_000_000n * 4n);
      expect(c.totalGpu).toBe(0n + 4n);
    });

    it("count=0 contributes nothing to totals", () => {
      const c = aggregateCriteria([makeUnit({ cpu: 1000n, memory: 1n, gpu: 1n, count: 0 })], makeRequirements());
      expect(c.totalCpu).toBe(0n);
      expect(c.totalMemory).toBe(0n);
      expect(c.totalGpu).toBe(0n);
    });

    it("routes persistent and ephemeral storage to separate totals", () => {
      const c = aggregateCriteria(
        [
          makeUnit({
            count: 2,
            storage: [
              {
                name: "data",
                quantity: 1000n,
                attributes: [
                  { key: "persistent", value: "true" },
                  { key: "class", value: "beta2" }
                ]
              },
              { name: "scratch", quantity: 500n, attributes: [] }
            ]
          })
        ],
        makeRequirements()
      );
      expect(c.totalPersistentStorage).toBe(2000n);
      expect(c.totalEphemeralStorage).toBe(1000n);
    });

    it("rolls ram-class volumes into totalMemory and leaves storage totals untouched", () => {
      const c = aggregateCriteria(
        [
          makeUnit({
            memory: 100n,
            count: 3,
            storage: [{ name: "shm", quantity: 50n, attributes: [{ key: "class", value: "ram" }] }]
          })
        ],
        makeRequirements()
      );
      expect(c.totalMemory).toBe((100n + 50n) * 3n);
      expect(c.totalEphemeralStorage).toBe(0n);
      expect(c.totalPersistentStorage).toBe(0n);
    });

    it("sums multiple ram-class volumes on a single unit into totalMemory", () => {
      const c = aggregateCriteria(
        [
          makeUnit({
            memory: 100n,
            count: 1,
            storage: [
              { name: "shm1", quantity: 25n, attributes: [{ key: "class", value: "ram" }] },
              { name: "shm2", quantity: 75n, attributes: [{ key: "class", value: "ram" }] }
            ]
          })
        ],
        makeRequirements()
      );
      expect(c.totalMemory).toBe(200n);
    });

    it("partitions ram, ephemeral, and persistent volumes on the same unit without double-counting", () => {
      const c = aggregateCriteria(
        [
          makeUnit({
            memory: 100n,
            count: 2,
            storage: [
              { name: "shm", quantity: 50n, attributes: [{ key: "class", value: "ram" }] },
              { name: "scratch", quantity: 500n, attributes: [] },
              {
                name: "data",
                quantity: 1000n,
                attributes: [
                  { key: "persistent", value: "true" },
                  { key: "class", value: "beta2" }
                ]
              }
            ]
          })
        ],
        makeRequirements()
      );
      expect(c.totalMemory).toBe((100n + 50n) * 2n);
      expect(c.totalEphemeralStorage).toBe(500n * 2n);
      expect(c.totalPersistentStorage).toBe(1000n * 2n);
    });
  });

  describe("totalLeasedIps", () => {
    it("counts each LEASED_IP endpoint by its unique sequenceNumber", () => {
      const c = aggregateCriteria(
        [
          makeUnit({
            endpoints: [
              { kind: "LEASED_IP", sequenceNumber: 1 },
              { kind: "LEASED_IP", sequenceNumber: 2 }
            ]
          })
        ],
        makeRequirements()
      );
      expect(c.totalLeasedIps).toBe(2n);
    });

    it("dedupes the same sequenceNumber declared across multiple units", () => {
      const c = aggregateCriteria(
        [makeUnit({ endpoints: [{ kind: "LEASED_IP", sequenceNumber: 1 }] }), makeUnit({ endpoints: [{ kind: "LEASED_IP", sequenceNumber: 1 }] })],
        makeRequirements()
      );
      expect(c.totalLeasedIps).toBe(1n);
    });

    it("dedupes a sequenceNumber repeated within a single unit's endpoints", () => {
      const c = aggregateCriteria(
        [
          makeUnit({
            endpoints: [
              { kind: "LEASED_IP", sequenceNumber: 7 },
              { kind: "LEASED_IP", sequenceNumber: 7 }
            ]
          })
        ],
        makeRequirements()
      );
      expect(c.totalLeasedIps).toBe(1n);
    });

    it("counts distinct sequenceNumbers across multiple units", () => {
      const c = aggregateCriteria(
        [makeUnit({ endpoints: [{ kind: "LEASED_IP", sequenceNumber: 1 }] }), makeUnit({ endpoints: [{ kind: "LEASED_IP", sequenceNumber: 2 }] })],
        makeRequirements()
      );
      expect(c.totalLeasedIps).toBe(2n);
    });

    it("ignores endpoints whose kind is not LEASED_IP", () => {
      const c = aggregateCriteria(
        [
          makeUnit({
            endpoints: [
              { kind: "SHARED_HTTP", sequenceNumber: 1 },
              { kind: "RANDOM_PORT", sequenceNumber: 2 },
              { kind: "LEASED_IP", sequenceNumber: 3 }
            ]
          })
        ],
        makeRequirements()
      );
      expect(c.totalLeasedIps).toBe(1n);
    });

    it("is unaffected by unit count — counts unique IPs, not replicas", () => {
      const c = aggregateCriteria([makeUnit({ count: 5, endpoints: [{ kind: "LEASED_IP", sequenceNumber: 1 }] })], makeRequirements());
      expect(c.totalLeasedIps).toBe(1n);
    });

    it("returns 0 when no endpoints request a leased IP", () => {
      const c = aggregateCriteria([makeUnit({ endpoints: [{ kind: "SHARED_HTTP", sequenceNumber: 1 }] })], makeRequirements());
      expect(c.totalLeasedIps).toBe(0n);
    });

    it("returns 0 when there are no endpoints at all", () => {
      const c = aggregateCriteria([makeUnit({})], makeRequirements());
      expect(c.totalLeasedIps).toBe(0n);
    });
  });

  describe("maxPerReplica", () => {
    it("picks max of unit.cpu — not max of unit.cpu * count", () => {
      const c = aggregateCriteria(
        [
          makeUnit({ cpu: 1000n, count: 5 }), // would be 5000 if multiplied
          makeUnit({ cpu: 4000n, count: 1 })
        ],
        makeRequirements()
      );
      expect(c.maxPerReplicaCpu).toBe(4000n);
    });

    it("picks max of unit.memory across units", () => {
      const c = aggregateCriteria([makeUnit({ memory: 1n, count: 100 }), makeUnit({ memory: 50n, count: 1 })], makeRequirements());
      expect(c.maxPerReplicaMemory).toBe(50n);
    });

    it("includes ram-class volume sizes when picking maxPerReplicaMemory", () => {
      const c = aggregateCriteria(
        [
          makeUnit({ memory: 100n, count: 1 }),
          makeUnit({
            memory: 30n,
            count: 1,
            storage: [{ name: "shm", quantity: 200n, attributes: [{ key: "class", value: "ram" }] }]
          })
        ],
        makeRequirements()
      );
      expect(c.maxPerReplicaMemory).toBe(230n);
    });

    it("picks max of unit.gpu across units", () => {
      const c = aggregateCriteria([makeUnit({ gpu: 1n, count: 8 }), makeUnit({ gpu: 4n, count: 1 })], makeRequirements());
      expect(c.maxPerReplicaGpu).toBe(4n);
    });
  });

  describe("attribute partition", () => {
    it("routes exact keys to attributes and trailing-* keys to globAttributes", () => {
      const c = aggregateCriteria(
        [makeUnit({})],
        makeRequirements({
          attributes: [
            { key: "region", value: "us-east" },
            { key: "host/*", value: "true" }
          ]
        })
      );
      expect(c.attributes).toEqual([{ key: "region", value: "us-east" }]);
      expect(c.globAttributes).toHaveLength(1);
      expect(c.globAttributes[0].value).toBe("true");
    });

    it("escapes regex specials in glob prefix (dot)", () => {
      const c = aggregateCriteria([makeUnit({})], makeRequirements({ attributes: [{ key: "host.gpu/*", value: "true" }] }));
      const re = new RegExp(c.globAttributes[0].keyPattern);
      expect(re.test("host.gpu/a")).toBe(true);
      expect(re.test("host.gpu/a/b")).toBe(false);
      expect(re.test("hostXgpu/a")).toBe(false);
    });

    it("uses [^/]* so glob does not cross path separators", () => {
      const c = aggregateCriteria([makeUnit({})], makeRequirements({ attributes: [{ key: "host/*", value: "true" }] }));
      const re = new RegExp(c.globAttributes[0].keyPattern);
      expect(re.test("host/gpu")).toBe(true);
      expect(re.test("host/gpu/foo")).toBe(false);
    });

    it("empty requirements.attributes produces empty arrays, not undefined", () => {
      const c = aggregateCriteria([makeUnit({})], makeRequirements());
      expect(c.attributes).toEqual([]);
      expect(c.globAttributes).toEqual([]);
    });
  });

  describe("signedBy", () => {
    it("passes allOf and anyOf through unchanged", () => {
      const c = aggregateCriteria([makeUnit({})], makeRequirements({ signedBy: { allOf: ["a", "b"], anyOf: ["c"] } }));
      expect(c.signedBy).toEqual({ allOf: ["a", "b"], anyOf: ["c"] });
    });

    it("empty signedBy arrays survive as empty arrays", () => {
      const c = aggregateCriteria([makeUnit({})], makeRequirements());
      expect(c.signedBy).toEqual({ allOf: [], anyOf: [] });
    });
  });

  describe("units dimension", () => {
    it("emits a per-unit filter slot for each unit in this slice", () => {
      const c = aggregateCriteria([makeUnit({}), makeUnit({})], makeRequirements());
      expect(c.units).toEqual([
        { gpuTokens: [], persistentClasses: [] },
        { gpuTokens: [], persistentClasses: [] }
      ]);
    });

    it("emits a vendor-only token when the GPU attribute has no model (wildcard)", () => {
      const c = aggregateCriteria([makeUnit({ gpu: 1n, gpuAttributes: [{ key: "vendor/nvidia", value: "true" }] })], makeRequirements());
      expect(c.units[0].gpuTokens).toEqual(["nvidia"]);
    });

    it("emits a vendor/model token when the GPU attribute specifies a model", () => {
      const c = aggregateCriteria([makeUnit({ gpu: 1n, gpuAttributes: [{ key: "vendor/nvidia/model/a100", value: "true" }] })], makeRequirements());
      expect(c.units[0].gpuTokens).toEqual(["nvidia/a100"]);
    });

    it("emits every OR-alternative token when a unit has multiple GPU attributes", () => {
      const c = aggregateCriteria(
        [
          makeUnit({
            gpu: 1n,
            gpuAttributes: [
              { key: "vendor/nvidia/model/a100", value: "true" },
              { key: "vendor/amd/model/mi300x", value: "true" }
            ]
          })
        ],
        makeRequirements()
      );
      expect(c.units[0].gpuTokens).toEqual(["nvidia/a100", "amd/mi300x"]);
    });

    it("emits an empty gpuTokens array for units that do not request a GPU", () => {
      const c = aggregateCriteria([makeUnit({ gpu: 0n })], makeRequirements());
      expect(c.units[0].gpuTokens).toEqual([]);
    });

    it("emits the single declared class for a unit with one persistent volume", () => {
      const c = aggregateCriteria(
        [
          makeUnit({
            storage: [
              {
                name: "data",
                quantity: 1000n,
                attributes: [
                  { key: "persistent", value: "true" },
                  { key: "class", value: "beta2" }
                ]
              }
            ]
          })
        ],
        makeRequirements()
      );
      expect(c.units[0].persistentClasses).toEqual(["beta2"]);
    });

    it("emits every distinct class declared across a unit's persistent volumes", () => {
      const c = aggregateCriteria(
        [
          makeUnit({
            storage: [
              {
                name: "data",
                quantity: 1000n,
                attributes: [
                  { key: "persistent", value: "true" },
                  { key: "class", value: "beta2" }
                ]
              },
              {
                name: "logs",
                quantity: 500n,
                attributes: [
                  { key: "persistent", value: "true" },
                  { key: "class", value: "beta3" }
                ]
              }
            ]
          })
        ],
        makeRequirements()
      );
      expect(c.units[0].persistentClasses).toEqual(["beta2", "beta3"]);
    });

    it("dedupes repeated classes across persistent volumes within a unit", () => {
      const c = aggregateCriteria(
        [
          makeUnit({
            storage: [
              {
                name: "data",
                quantity: 1000n,
                attributes: [
                  { key: "persistent", value: "true" },
                  { key: "class", value: "beta2" }
                ]
              },
              {
                name: "extra",
                quantity: 250n,
                attributes: [
                  { key: "persistent", value: "true" },
                  { key: "class", value: "beta2" }
                ]
              }
            ]
          })
        ],
        makeRequirements()
      );
      expect(c.units[0].persistentClasses).toEqual(["beta2"]);
    });

    it("ignores ephemeral and ram volumes when collecting persistentClasses", () => {
      const c = aggregateCriteria(
        [
          makeUnit({
            storage: [
              { name: "scratch", quantity: 500n, attributes: [] },
              { name: "shm", quantity: 100n, attributes: [{ key: "class", value: "ram" }] }
            ]
          })
        ],
        makeRequirements()
      );
      expect(c.units[0].persistentClasses).toEqual([]);
    });

    it("emits per-unit persistentClasses independently across units in a mixed deployment", () => {
      const c = aggregateCriteria(
        [
          makeUnit({
            storage: [
              {
                name: "data",
                quantity: 1000n,
                attributes: [
                  { key: "persistent", value: "true" },
                  { key: "class", value: "beta2" }
                ]
              }
            ]
          }),
          makeUnit({ storage: [{ name: "scratch", quantity: 500n, attributes: [] }] })
        ],
        makeRequirements()
      );
      expect(c.units[0].persistentClasses).toEqual(["beta2"]);
      expect(c.units[1].persistentClasses).toEqual([]);
    });
  });
});

function makeUnit(input: {
  cpu?: bigint;
  memory?: bigint;
  gpu?: bigint;
  count?: number;
  storage?: RawStorageVolume[];
  gpuAttributes?: ResourceAttribute[];
  endpoints?: Array<{ kind: string; sequenceNumber: number }>;
}): RequestedResourceUnit {
  return {
    id: 1,
    count: input.count ?? 1,
    resources: {
      cpu: { units: input.cpu ?? 0n, fingerprint: null },
      memory: { quantity: input.memory ?? 0n },
      gpu: { units: input.gpu ?? 0n, attributes: parseGPUAttributes(input.gpuAttributes ?? []) },
      storage: (input.storage ?? []).map(s => ({ name: s.name, quantity: s.quantity, attributes: parseStorageAttributes(s.attributes) })),
      endpoints: input.endpoints ?? []
    }
  };
}

function makeRequirements(input?: Partial<GroupSpecJSON["requirements"]>): GroupSpecJSON["requirements"] {
  return {
    signedBy: input?.signedBy ?? { allOf: [], anyOf: [] },
    attributes: input?.attributes ?? []
  };
}
