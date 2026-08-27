import { type VerificationRequirement, VerificationTier } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { withSpan } from "@akashnetwork/instrumentation";
import { evaluateProviderVerification, type ProviderVerificationFacts } from "@akashnetwork/provider-verification";
import type { Abortable } from "node:events";
import { inject, singleton } from "tsyringe";

import { mapStoredProviderVerificationFacts } from "@src/mappers/provider-verification-mapper/provider-verification-mapper";
import { bidScreeningBinPackerMatched, bidScreeningPrefilterCandidates } from "@src/metrics/metrics";
import { LOGGER_FACTORY, type LoggerFactory, LoggerService } from "@src/providers/logger-factory.provider";
import { type BidScreeningCandidate, BidScreeningRepository } from "@src/repositories/bid-screening/bid-screening.repository";
import { DailyDowntimeRow, ProviderIncidentRepository } from "@src/repositories/provider-incident/provider-incident.repository";
import type { GroupSpecJSON } from "../../mappers/groupspec-mapper/groupspec-mapper";
import { mapGroupSpecToResourceUnits } from "../../mappers/groupspec-mapper/groupspec-mapper";
import type { BidScreeningExclusion, BidScreeningResult, BidScreeningSelection, RequestedResourceUnit } from "../../types/inventory";
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

  async findMatchingProviders(request: BidScreeningInput, options?: Abortable): Promise<BidScreeningResult[]> {
    return (await this.screenProviders(request, options)).providers;
  }

  async screenProviders(request: BidScreeningInput, options?: Abortable): Promise<BidScreeningSelection> {
    const resourceUnits = await withSpan("mapRequestToResourceUnits", async () => mapGroupSpecToResourceUnits(request));

    this.#logger.info({ event: "BID_SCREENING_START", resourceGroupCount: resourceUnits.length });
    const candidates = await withSpan("fetchCandidatesFromDB", async () => {
      if (options?.signal?.aborted) return [];

      const items = await this.#repository.findCandidates(resourceUnits, { ...request.requirements, reclamationWindow: request.reclamationWindow });
      bidScreeningPrefilterCandidates.record(items.length);
      this.#logger.info({ event: "BID_SCREENING_CANDIDATES_FETCHED", count: items.length });
      return items;
    });

    const matched = await withSpan("applyingBinPackingAlg", async () => {
      if (options?.signal?.aborted) return [];
      const items = this.#filterProviders(candidates, resourceUnits);
      bidScreeningBinPackerMatched.record(items.length);
      return items;
    });

    const verificationRequirement = effectiveVerificationRequirement(request.requirements.verification);
    const screening = this.#screenByVerification(matched, verificationRequirement);
    this.#logger.info({
      event: "BID_SCREENING_COMPLETE",
      candidatesCount: candidates.length,
      capacityMatchedCount: matched.length,
      excludedByVerificationCount: screening.exclusions.length,
      matchedCount: screening.providers.length,
      verificationNotEvaluatedCount: screening.providers.filter(provider => provider.verification?.outcome === "not_evaluated").length
    });

    const incidentsByOwner: Partial<Record<string, Omit<DailyDowntimeRow, "provider">[]>> = await withSpan(
      "fetchIncidentsForMatched",
      async ({ activeSpan }) => {
        if (!screening.providers.length || options?.signal?.aborted) return EMPTY_OBJECT;
        const rows = await this.#incidentRepository.findDailyDowntimeByProviders(
          screening.providers.map(({ candidate }) => candidate.owner),
          request.timezone
        );
        activeSpan.setAttribute("amountOfIncidents", rows.length);

        const grouped = Object.create(null);
        for (const { provider, ...row } of rows) {
          grouped[provider] ??= [];
          grouped[provider]!.push(row);
        }

        this.#logger.info({
          event: "BID_SCREENING_PROVIDER_INCIDENTS_FETCHED",
          incidentsCount: rows.length
        });
        return grouped;
      }
    );

    const providers = screening.providers.map(({ candidate, verification }) => this.#toResult(candidate, incidentsByOwner, verification));
    return verificationRequirement ? { providers, exclusions: screening.exclusions } : { providers };
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

  #screenByVerification(candidates: BidScreeningCandidate[], requirement: VerificationRequirement | null): VerificationScreeningResult {
    if (!requirement) return { providers: candidates.map(candidate => ({ candidate })), exclusions: [] };

    const providers: VerificationScreeningResult["providers"] = [];
    const exclusions: BidScreeningExclusion[] = [];

    for (const candidate of candidates) {
      const stored = candidate.verification;
      const facts = stored ? mapStoredProviderVerificationFacts(stored) : unknownVerificationFacts();
      const evaluation = evaluateProviderVerification({ facts, moduleActive: stored?.moduleActive ?? null, requirement });

      if (evaluation.outcome === "fail") {
        exclusions.push({
          owner: candidate.owner,
          firstFailure: evaluation.firstFailure,
          failures: evaluation.failures,
          summary: evaluation.summary
        });
      } else if (evaluation.outcome === "unknown") {
        providers.push({
          candidate,
          verification: { outcome: "not_evaluated", incompleteFacts: evaluation.incompleteFacts, summary: evaluation.summary }
        });
      } else if (stored?.moduleActive === false) {
        providers.push({
          candidate,
          verification: { outcome: "not_evaluated", incompleteFacts: ["module_inactive"], summary: evaluation.summary }
        });
      } else {
        providers.push({ candidate, verification: { outcome: "pass", summary: evaluation.summary } });
      }
    }

    return { exclusions, providers };
  }

  #toResult(
    candidate: BidScreeningCandidate,
    incidentsByOwner: Partial<Record<string, Omit<DailyDowntimeRow, "provider">[]>>,
    verification?: BidScreeningResult["verification"]
  ): BidScreeningResult {
    return {
      owner: candidate.owner,
      hostUri: candidate.hostUri,
      isAudited: candidate.isAudited,
      createdAt: candidate.createdAt,
      location: candidate.location,
      organization: candidate.organization,
      incidents: incidentsByOwner[candidate.owner] ?? [],
      ...(verification ? { verification } : {})
    };
  }
}

export interface BidScreeningInput extends Omit<GroupSpecJSON, "name"> {
  timezone: string;
  reclamationWindow?: number;
}

interface VerificationScreeningResult {
  providers: Array<{ candidate: BidScreeningCandidate; verification?: BidScreeningResult["verification"] }>;
  exclusions: BidScreeningExclusion[];
}

function effectiveVerificationRequirement(requirement: VerificationRequirement | undefined): VerificationRequirement | null {
  return !requirement || requirement.minTier === VerificationTier.verification_tier_unspecified ? null : requirement;
}

function unknownVerificationFacts(): ProviderVerificationFacts {
  const facts: ProviderVerificationFacts = {
    attestations: [],
    completeness: { attestations: false, graces: false, snapshot: false },
    graces: [],
    observedAt: new Date(0),
    observedHeight: "",
    snapshot: null
  };

  return facts;
}
