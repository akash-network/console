import { withSpan } from "@akashnetwork/instrumentation";
import type { Abortable } from "node:events";
import { inject, singleton } from "tsyringe";

import { bidScreeningBinPackerMatched, bidScreeningPrefilterCandidates } from "@src/metrics/metrics";
import { LOGGER_FACTORY, type LoggerFactory, LoggerService } from "@src/providers/logger-factory.provider";
import { type BidScreeningCandidate, BidScreeningRepository } from "@src/repositories/bid-screening/bid-screening.repository";
import { ProviderIncidentRepository, RecentIncidentRow } from "@src/repositories/provider-incident/provider-incident.repository";
import type { GroupSpecJSON } from "../../mappers/groupspec-mapper/groupspec-mapper";
import { mapGroupSpecToResourceUnits } from "../../mappers/groupspec-mapper/groupspec-mapper";
import type { BidScreeningResult, Incident, RequestedResourceUnit } from "../../types/inventory";
import { ClusterInventoryMatcherService } from "../cluster-inventory-matcher/cluster-inventory-matcher.service";

const EMPTY_OBJECT = Object.freeze(Object.create(null));

@singleton()
export class BidScreeningService {
  readonly #repository: BidScreeningRepository;
  readonly #incidentRepository: ProviderIncidentRepository;
  readonly #matcher: ClusterInventoryMatcherService;
  readonly #logger: LoggerService;

  constructor(
    repository: BidScreeningRepository,
    incidentRepository: ProviderIncidentRepository,
    matcher: ClusterInventoryMatcherService,
    @inject(LOGGER_FACTORY) createLogger: LoggerFactory
  ) {
    this.#repository = repository;
    this.#incidentRepository = incidentRepository;
    this.#matcher = matcher;
    this.#logger = createLogger({ context: "BidScreeningService" });
  }

  async findMatchingProviders(request: GroupSpecJSON, options?: Abortable): Promise<BidScreeningResult[]> {
    const resourceUnits = await withSpan("mapRequestToResourceUnits", async () => mapGroupSpecToResourceUnits(request));

    this.#logger.info({ event: "BID_SCREENING_START", resourceGroupCount: resourceUnits.length });
    const candidates = await withSpan("fetchCandidatesFromDB", async () => {
      if (options?.signal?.aborted) return [];

      const items = await this.#repository.findCandidates(resourceUnits, request.requirements);
      bidScreeningPrefilterCandidates.record(items.length);
      this.#logger.info({ event: "BID_SCREENING_CANDIDATES_FETCHED", count: items.length });
      return items;
    });

    const matched = await withSpan("applyingBinPackingAlg", async () => {
      if (options?.signal?.aborted) return [];
      const items = this.#filterProviders(candidates, resourceUnits);
      bidScreeningBinPackerMatched.record(items.length);
      this.#logger.info({
        event: "BID_SCREENING_COMPLETE",
        candidatesCount: candidates.length,
        matchedCount: items.length
      });
      return items;
    });

    const incidentsByOwner = await withSpan("fetchIncidentsForMatched", async ({ activeSpan }) => {
      if (!matched.length || options?.signal?.aborted) return EMPTY_OBJECT;
      const rows = await this.#incidentRepository.findRecentByProviders(matched.map(candidate => candidate.owner));
      activeSpan.setAttribute("amountOfIncidents", rows.length);

      const grouped = Object.create(null) as Partial<Record<string, Pick<RecentIncidentRow, "startedAt" | "endedAt">[]>>;
      for (const row of rows) {
        grouped[row.provider] ??= [];
        grouped[row.provider]!.push({ startedAt: row.startedAt, endedAt: row.endedAt });
      }

      this.#logger.info({
        event: "BID_SCREENING_PROVIDER_INCIDENTS_FETCHED",
        incidentsCount: rows.length
      });
      return grouped;
    });

    return matched.map(candidate => this.#toResult(candidate, incidentsByOwner));
  }

  #filterProviders(candidates: BidScreeningCandidate[], resourceUnits: RequestedResourceUnit[]): BidScreeningCandidate[] {
    if (!candidates.length) return [];
    if (!resourceUnits.length) return candidates;
    const matched: BidScreeningCandidate[] = [];

    for (const candidate of candidates) {
      const matchResult = this.#matcher.match(candidate.cluster, resourceUnits);

      if (matchResult.matched) {
        matched.push(candidate);
      }
    }

    return matched;
  }

  #toResult(candidate: BidScreeningCandidate, incidentsByOwner: Record<string, Incident[]>): BidScreeningResult {
    return {
      owner: candidate.owner,
      hostUri: candidate.hostUri,
      isAudited: candidate.isAudited,
      createdAt: candidate.createdAt,
      location: candidate.location,
      incidents: incidentsByOwner[candidate.owner] ?? []
    };
  }
}
