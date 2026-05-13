import { BadRequest } from "http-errors";
import { inject, singleton } from "tsyringe";

import { LoggerService } from "@src/providers/logging.provider";
import { ProviderInventoryRepository } from "@src/repositories/provider-inventory/provider-inventory.repository";
import type { GroupSpecJSON } from "../../lib/groupspec-mapper/groupspec-mapper";
import { mapGroupSpecToResourceUnits } from "../../lib/groupspec-mapper/groupspec-mapper";
import type { BidScreeningResult } from "../../types/inventory.types";
import type { ProviderWithClusterState } from "../../types/provider";
import { ClusterInventoryMatcherService } from "../cluster-inventory-matcher/cluster-inventory-matcher.service";

const AUDITOR = "akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63";

@singleton()
export class BidScreeningService {
  readonly #repository: ProviderInventoryRepository;
  readonly #matcher: ClusterInventoryMatcherService;
  readonly #logger: LoggerService;

  constructor(
    @inject(ProviderInventoryRepository) repository: ProviderInventoryRepository,
    @inject(ClusterInventoryMatcherService) matcher: ClusterInventoryMatcherService,
    @inject(LoggerService) logger: LoggerService
  ) {
    this.#repository = repository;
    this.#matcher = matcher;
    this.#logger = logger;
  }

  async findMatchingProviders(request: GroupSpecJSON): Promise<BidScreeningResult[]> {
    const startTime = Date.now();

    this.#validateRequest(request);

    const resourceUnits = mapGroupSpecToResourceUnits(request);

    this.#logger.info({ event: "BID_SCREENING_START", resourceGroupCount: resourceUnits.length });

    const [providers, auditedOwners] = await Promise.all([this.#repository.getOnlineProviders(), this.#repository.getAuditedProviderAddresses([AUDITOR])]);

    const results: BidScreeningResult[] = [];

    for (const provider of providers) {
      const matchResult = this.#matcher.match(provider.cluster, resourceUnits);

      if (matchResult.matched) {
        results.push(this.#toResult(provider, auditedOwners.has(provider.owner)));
      }
    }

    this.#logger.info({
      event: "BID_SCREENING_COMPLETE",
      providerCount: providers.length,
      matchedCount: results.length,
      durationMs: Date.now() - startTime
    });

    return results;
  }

  #validateRequest(request: GroupSpecJSON): void {
    if (request.resources.length === 0) {
      throw new BadRequest("GroupSpec must contain at least one resource unit");
    }

    for (let i = 0; i < request.resources.length; i++) {
      const resource = request.resources[i].resource;

      for (let j = 0; j < resource.storage.length; j++) {
        const vol = resource.storage[j];
        const isPersistent = vol.attributes.some(a => a.key === "persistent" && a.value === "true");
        const storageClass = vol.attributes.find(a => a.key === "class")?.value;
        const isRam = storageClass === "ram";

        if (isPersistent && (!storageClass || isRam)) {
          throw new BadRequest(`Persistent storage volume "${vol.name}" must specify a valid storage class (not "${storageClass || "empty"}")`);
        }
      }
    }
  }

  #toResult(provider: ProviderWithClusterState, isAudited: boolean): BidScreeningResult {
    return {
      owner: provider.owner,
      hostUri: provider.hostUri,
      region: provider.ipRegion ?? null,
      uptime7d: provider.uptime7d ?? null,
      isAudited
    };
  }
}
