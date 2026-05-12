import type { Sql } from "postgres";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { EnvConfig } from "@src/config/env.config";
import type { ResourceAggregates } from "@src/lib/resource-aggregator/resource-aggregator";
import type { LoggerFactory } from "@src/providers/logger-factory.provider";
import { BidScreeningRepository } from "./bid-screening.repository";

describe(BidScreeningRepository.name, () => {
  describe("buildQuery", () => {
    it("filters by is_online and is_online_since", () => {
      const { repository } = setup();

      const { sql } = repository.buildQuery(makeAggregates(), {});

      expect(sql).toContain("is_online = TRUE");
      expect(sql).toContain("is_online_since IS NOT NULL");
    });

    it("applies all aggregate prefilter predicates with bigint values", () => {
      const { repository } = setup();

      const { sql, params } = repository.buildQuery(
        makeAggregates({
          totalCpu: 1000n,
          totalMemory: 2000n,
          totalGpu: 3n,
          totalEphemeralStorage: 4000n,
          totalPersistentStorage: 5000n,
          maxPerReplicaCpu: 600n,
          maxPerReplicaMemory: 700n,
          maxPerReplicaGpu: 1n
        }),
        {}
      );

      expect(sql).toMatch(/total_available_cpu >= \$\d+::bigint/);
      expect(sql).toMatch(/total_available_memory >= \$\d+::bigint/);
      expect(sql).toMatch(/total_available_gpu >= \$\d+::bigint/);
      expect(sql).toMatch(/total_available_eph >= \$\d+::bigint/);
      expect(sql).toMatch(/total_available_persistent >= \$\d+::bigint/);
      expect(sql).toMatch(/max_node_free_cpu >= \$\d+::bigint/);
      expect(sql).toMatch(/max_node_free_memory >= \$\d+::bigint/);
      expect(sql).toMatch(/max_node_free_gpu >= \$\d+::bigint/);
      expect(params).toEqual(expect.arrayContaining(["1000", "2000", "3", "4000", "5000", "600", "700", "1"]));
    });

    it("adds exact gpu vendor/model match when both are specified", () => {
      const { repository } = setup();

      const { sql, params } = repository.buildQuery(makeAggregates({ gpuVendor: "nvidia", gpuModel: "a100" }), {});

      expect(sql).toMatch(/gpu_models && ARRAY\[\$\d+\]::text\[\]/);
      expect(params).toContain("nvidia/a100");
    });

    it("adds vendor-only LIKE match when model is wildcard", () => {
      const { repository } = setup();

      const { sql, params } = repository.buildQuery(makeAggregates({ gpuVendor: "nvidia" }), {});

      expect(sql).toContain("EXISTS (SELECT 1 FROM unnest(gpu_models) m WHERE m LIKE");
      expect(params).toContain("nvidia/%");
    });

    it("adds persistent storage class containment when class is specified", () => {
      const { repository } = setup();

      const { sql, params } = repository.buildQuery(makeAggregates({ persistentStorageClass: "beta2" }), {});

      expect(sql).toMatch(/storage_classes @> ARRAY\[\$\d+\]::text\[\]/);
      expect(params).toContain("beta2");
    });

    it("adds jsonb containment for an exact self-attribute match", () => {
      const { repository } = setup();

      const { sql, params } = repository.buildQuery(makeAggregates(), { attributes: [{ key: "region", value: "us-east" }] });

      expect(sql).toMatch(/self_attributes @> \$\d+::jsonb/);
      expect(params).toContain(JSON.stringify([{ key: "region", value: "us-east" }]));
    });

    it("converts glob patterns to regex via ~ over jsonb_array_elements", () => {
      const { repository } = setup();

      const { sql, params } = repository.buildQuery(makeAggregates(), { attributes: [{ key: "region", value: "us-*" }] });

      expect(sql).toContain("EXISTS (SELECT 1 FROM jsonb_array_elements(self_attributes) a WHERE");
      expect(sql).toMatch(/a->>'key' = \$\d+/);
      expect(sql).toMatch(/a->>'value' ~ \$\d+/);
      expect(params).toContain("region");
      expect(params).toContain("^us-.*$");
    });

    it("anchors and escapes glob patterns when building regex (only * is a wildcard)", () => {
      const { repository } = setup();

      const { params } = repository.buildQuery(makeAggregates(), { attributes: [{ key: "tier", value: "prem.?um.*" }] });

      expect(params).toContain("^prem\\.\\?um\\..*$");
    });

    it("uses overlap operator for signedBy.anyOf", () => {
      const { repository } = setup();

      const { sql, params } = repository.buildQuery(makeAggregates(), { signedBy: { anyOf: ["a", "b"] } });

      expect(sql).toMatch(/audited_by && \$\d+::text\[\]/);
      expect(params).toContainEqual(["a", "b"]);
    });

    it("uses containment operator for signedBy.allOf", () => {
      const { repository } = setup();

      const { sql, params } = repository.buildQuery(makeAggregates(), { signedBy: { allOf: ["a", "b"] } });

      expect(sql).toMatch(/audited_by @> \$\d+::text\[\]/);
      expect(params).toContainEqual(["a", "b"]);
    });

    it("omits anyOf and allOf clauses from WHERE when arrays are empty", () => {
      const { repository } = setup();

      const { sql } = repository.buildQuery(makeAggregates(), { signedBy: { anyOf: [], allOf: [] } });
      const whereClause = sql.split("WHERE")[1] ?? "";

      expect(whereClause).not.toContain("audited_by &&");
      expect(whereClause).not.toContain("audited_by @>");
    });

    it("projects is_audited from audited_by containment against configured AUDITOR_ADDRESS", () => {
      const { repository } = setup({ AUDITOR_ADDRESS: "akash1auditor" });

      const { sql, params } = repository.buildQuery(makeAggregates(), {});

      expect(sql).toMatch(/audited_by @> ARRAY\[\$\d+\]::text\[\]\) AS is_audited/);
      expect(params).toContain("akash1auditor");
    });
  });

  function setup(envOverrides?: Partial<EnvConfig>) {
    const pg = mock<Pick<Sql, "unsafe">>() as unknown as Sql;
    const config = { AUDITOR_ADDRESS: "akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63", ...envOverrides } as EnvConfig;
    const logger = mock<ReturnType<LoggerFactory>>();
    const loggerFactory: LoggerFactory = () => logger;
    const repository = new BidScreeningRepository(pg, config, loggerFactory);
    return { repository, pg };
  }
});

function makeAggregates(overrides?: Partial<ResourceAggregates>): ResourceAggregates {
  return {
    totalCpu: 0n,
    totalMemory: 0n,
    totalGpu: 0n,
    maxPerReplicaCpu: 0n,
    maxPerReplicaMemory: 0n,
    maxPerReplicaGpu: 0n,
    totalEphemeralStorage: 0n,
    totalPersistentStorage: 0n,
    ...overrides
  };
}
