import type { LoggerService } from "@akashnetwork/logging";
import type { ParameterOrJSON, Sql } from "postgres";
import { inject, singleton } from "tsyringe";

import type { EnvConfig } from "@src/config/env.config";
import type { ResourceAggregates } from "@src/lib/resource-aggregator/resource-aggregator";
import { APP_CONFIG } from "@src/providers/app-config.provider";
import type { LoggerFactory } from "@src/providers/logger-factory.provider";
import { LOGGER_FACTORY } from "@src/providers/logger-factory.provider";
import { PG_CLIENT } from "@src/providers/postgres.provider";
import type { Inventory } from "@src/types/inventory";
import type { ProviderWithSnapshot } from "@src/types/provider";

export interface BidScreeningRequirements {
  signedBy?: { allOf?: string[]; anyOf?: string[] };
  attributes?: { key: string; value: string }[];
}

export interface BidScreeningCandidate extends ProviderWithSnapshot {
  isAudited: boolean;
}

interface CandidateRow {
  owner: string;
  host_uri: string;
  ip_region: string | null;
  uptime_7d: number | null;
  inventory: Inventory;
  is_audited: boolean;
}

const STORAGE_CLASS_TO_CAPABILITY = {
  beta1: "capabilitiesStorageHDD",
  beta2: "capabilitiesStorageSSD",
  beta3: "capabilitiesStorageNVME"
} as const;

@singleton()
export class BidScreeningRepository {
  readonly #logger: LoggerService;
  readonly #pg: Sql;
  readonly #auditorAddress: string;

  constructor(@inject(PG_CLIENT) pg: Sql, @inject(APP_CONFIG) config: EnvConfig, @inject(LOGGER_FACTORY) loggerFactory: LoggerFactory) {
    this.#pg = pg;
    this.#auditorAddress = config.AUDITOR_ADDRESS;
    this.#logger = loggerFactory({ context: "BidScreeningRepository" });
  }

  async findCandidates(aggregates: ResourceAggregates, requirements: BidScreeningRequirements): Promise<BidScreeningCandidate[]> {
    const { sql, params } = this.buildQuery(aggregates, requirements);

    this.#logger.debug({ event: "BID_SCREENING_QUERY", sql, paramCount: params.length });

    const rows = await this.#pg.unsafe<CandidateRow[]>(sql, params);
    return rows.map(row => this.#hydrate(row));
  }

  buildQuery(aggregates: ResourceAggregates, requirements: BidScreeningRequirements): { sql: string; params: ParameterOrJSON<never>[] } {
    const params: ParameterOrJSON<never>[] = [];
    const param = (value: ParameterOrJSON<never>): string => {
      params.push(value);
      return `$${params.length}`;
    };

    const wheres: string[] = ["is_online = TRUE", "is_online_since IS NOT NULL"];

    wheres.push(`total_available_cpu >= ${param(aggregates.totalCpu.toString())}::bigint`);
    wheres.push(`total_available_memory >= ${param(aggregates.totalMemory.toString())}::bigint`);
    wheres.push(`total_available_gpu >= ${param(aggregates.totalGpu.toString())}::bigint`);
    wheres.push(`total_available_eph >= ${param(aggregates.totalEphemeralStorage.toString())}::bigint`);
    wheres.push(`total_available_persistent >= ${param(aggregates.totalPersistentStorage.toString())}::bigint`);
    wheres.push(`max_node_free_cpu >= ${param(aggregates.maxPerReplicaCpu.toString())}::bigint`);
    wheres.push(`max_node_free_memory >= ${param(aggregates.maxPerReplicaMemory.toString())}::bigint`);
    wheres.push(`max_node_free_gpu >= ${param(aggregates.maxPerReplicaGpu.toString())}::bigint`);

    if (aggregates.gpuVendor) {
      if (aggregates.gpuModel) {
        wheres.push(`gpu_models && ARRAY[${param(`${aggregates.gpuVendor.toLowerCase()}/${aggregates.gpuModel.toLowerCase()}`)}]::text[]`);
      } else {
        wheres.push(`EXISTS (SELECT 1 FROM unnest(gpu_models) m WHERE m LIKE ${param(`${aggregates.gpuVendor.toLowerCase()}/%`)})`);
      }
    }

    if (aggregates.persistentStorageClass) {
      wheres.push(`storage_classes @> ARRAY[${param(aggregates.persistentStorageClass)}]::text[]`);
    }

    for (const attribute of requirements.attributes ?? []) {
      if (isGlobPattern(attribute.value)) {
        const regex = globToPostgresRegex(attribute.value);
        wheres.push(
          `EXISTS (SELECT 1 FROM jsonb_array_elements(self_attributes) a WHERE a->>'key' = ${param(attribute.key)} AND a->>'value' ~ ${param(regex)})`
        );
      } else {
        const literal = JSON.stringify([{ key: attribute.key, value: attribute.value }]);
        wheres.push(`self_attributes @> ${param(literal)}::jsonb`);
      }
    }

    const anyOf = requirements.signedBy?.anyOf ?? [];
    if (anyOf.length > 0) {
      wheres.push(`audited_by && ${param(anyOf)}::text[]`);
    }

    const allOf = requirements.signedBy?.allOf ?? [];
    if (allOf.length > 0) {
      wheres.push(`audited_by @> ${param(allOf)}::text[]`);
    }

    const sql = `
      SELECT
        owner,
        host_uri,
        ip_region,
        uptime_7d,
        inventory,
        (audited_by @> ARRAY[${param(this.#auditorAddress)}]::text[]) AS is_audited
      FROM provider_inventory
      WHERE ${wheres.join(" AND ")}
    `;

    return { sql, params };
  }

  #hydrate(row: CandidateRow): BidScreeningCandidate {
    const inventory = row.inventory ?? { nodes: [], storage: [] };

    const nodes = (inventory.nodes ?? []).map(node => {
      const capabilities = { capabilitiesStorageHDD: false, capabilitiesStorageSSD: false, capabilitiesStorageNVME: false };
      for (const ps of node.persistentStorage ?? []) {
        const capability = STORAGE_CLASS_TO_CAPABILITY[ps.class as keyof typeof STORAGE_CLASS_TO_CAPABILITY];
        if (capability) capabilities[capability] = true;
      }

      let gpuAllocatable = 0;
      const gpus: ProviderWithSnapshot["lastSuccessfulSnapshot"]["nodes"][number]["gpus"] = [];
      for (const gpu of node.gpu ?? []) {
        gpuAllocatable += gpu.available;
        for (let i = 0; i < gpu.available; i++) {
          gpus.push({
            vendor: gpu.vendor,
            name: gpu.model,
            modelId: gpu.modelId ?? "",
            interface: gpu.interface ?? "",
            memorySize: gpu.memorySize ?? ""
          });
        }
      }

      return {
        name: node.name,
        cpuAllocatable: node.cpu.available,
        cpuAllocated: 0,
        memoryAllocatable: node.memory.available,
        memoryAllocated: 0,
        ephemeralStorageAllocatable: node.ephStorage.available,
        ephemeralStorageAllocated: 0,
        gpuAllocatable,
        gpuAllocated: 0,
        ...capabilities,
        gpus,
        cpus: []
      };
    });

    const storage = (inventory.storage ?? []).map(s => ({
      class: s.class,
      allocatable: s.available,
      allocated: 0
    }));

    return {
      owner: row.owner,
      hostUri: row.host_uri,
      ipRegion: row.ip_region,
      uptime7d: row.uptime_7d,
      isAudited: row.is_audited,
      lastSuccessfulSnapshot: { nodes, storage }
    };
  }
}

function isGlobPattern(value: string): boolean {
  return value.includes("*");
}

function globToPostgresRegex(pattern: string): string {
  const escaped = pattern.replace(/[.+^${}()|[\]\\?]/g, "\\$&"); // do not escape * as it is our wildcard
  return "^" + escaped.replace(/\*+/g, ".*") + "$";
}
