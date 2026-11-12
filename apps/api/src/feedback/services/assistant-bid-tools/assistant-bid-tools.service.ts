import type { GroupSpec } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { inject, singleton } from "tsyringe";

import { BidController } from "@src/bid/controllers/bid/bid.controller";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { DeploymentController } from "@src/deployment/controllers/deployment/deployment.controller";
import { BidScreeningHttpService } from "@src/deployment/services/bid-screening-http/bid-screening-http.service";
import { PlacementOptionsHttpService } from "@src/deployment/services/placement-options-http/placement-options-http.service";
import { SdlService } from "@src/deployment/services/sdl/sdl.service";
import { extractRequestedGpusFromGroupSpecs } from "@src/deployment/utils/blocked-gpu/blocked-gpu";
import { AssistantToolError } from "@src/feedback/lib/assistant-tool-error/assistant-tool-error";
import type { ReadToolArguments } from "@src/feedback/lib/assistant-tools/assistant-tool-arguments";
import { AssistantAddressNamesService } from "@src/feedback/services/assistant-address-names/assistant-address-names.service";
import { AssistantUsdService } from "@src/feedback/services/assistant-usd/assistant-usd.service";

export interface GroupAvailability {
  group: string;
  requestedGpus: string[];
  providersAbleToBid: number | null;
  reason?: string;
}

export interface SdlAvailability {
  providersAbleToBid: number | null;
  groups: GroupAvailability[];
  gpuModelsWithFreeCapacity: string[] | null;
}

@singleton()
export class AssistantBidToolsService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly bidController: BidController,
    private readonly deploymentController: DeploymentController,
    private readonly sdlService: SdlService,
    private readonly bidScreeningHttpService: BidScreeningHttpService,
    private readonly placementOptionsHttpService: PlacementOptionsHttpService,
    private readonly usdService: AssistantUsdService,
    private readonly addressNamesService: AssistantAddressNamesService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: AssistantBidToolsService.name });
  }

  /** Screens availability only for a deployment still waiting on its first bid, since that is the only case it explains. */
  async getBids({ dseq }: ReadToolArguments<"get_bids">) {
    const [{ data: bids }, { data: deployment }] = await Promise.all([this.bidController.list(dseq), this.deploymentController.findByDseq(dseq)]);
    const providerNames = await this.addressNamesService.providerNamesOf(bids.map(({ bid }) => bid.id.provider));
    const isWaitingOnBids = deployment.deployment.state === "active" && deployment.leases.length === 0 && !bids.some(({ bid }) => bid.state === "open");

    return {
      dseq,
      name: deployment.name,
      deploymentState: deployment.deployment.state,
      leaseCount: deployment.leases.length,
      bids: await Promise.all(
        bids.map(async ({ bid }) => ({
          gseq: bid.id.gseq,
          oseq: bid.id.oseq,
          providerName: providerNames.get(bid.id.provider) ?? null,
          providerAddress: bid.id.provider,
          state: bid.state,
          usdPerMonth: await this.usdService.usdPerMonthOf([bid.price]),
          reclamationWindow: bid.reclamation_window ?? null
        }))
      ),
      availability: isWaitingOnBids ? await this.#availabilityOf(deployment.consoleSettings?.sdl) : null
    };
  }

  /** Screens the exact SDL a proposal would deploy, validated with the checks a create runs. */
  async checkAvailability(sdl: string, options: { isTrialing: boolean }): Promise<SdlAvailability> {
    const manifest = await this.sdlService.generateManifest(sdl, options);
    if (!manifest.ok) throw new AssistantToolError("The SDL is not valid.", manifest.value.map(({ message }) => message).join("; "));

    return await this.#availabilityOfGroups(manifest.value.groupSpecs);
  }

  async #availabilityOf(sdl: string | undefined): Promise<SdlAvailability | null> {
    if (!sdl) return null;

    const manifest = await this.sdlService.generateManifest(sdl);
    return manifest.ok ? await this.#availabilityOfGroups(manifest.value.groupSpecs) : null;
  }

  async #availabilityOfGroups(groupSpecs: GroupSpec[]): Promise<SdlAvailability> {
    const requestsGpus = extractRequestedGpusFromGroupSpecs(groupSpecs).length > 0;
    const [screened, gpuModelsWithFreeCapacity] = await Promise.all([
      Promise.all(groupSpecs.map(async groupSpec => ({ groupSpec, availability: await this.#screen(groupSpec) }))),
      requestsGpus ? this.#findAvailableGpuModels() : null
    ]);
    const groups = await Promise.all(
      screened.map(async ({ groupSpec, availability }) =>
        availability.providersAbleToBid === 0
          ? { ...availability, reason: await this.#reasonForNoBidders(groupSpec, availability.requestedGpus, gpuModelsWithFreeCapacity) }
          : availability
      )
    );
    const counts = groups.map(({ providersAbleToBid }) => providersAbleToBid);

    return { providersAbleToBid: counts.some(count => count === null) ? null : Math.min(...(counts as number[])), groups, gpuModelsWithFreeCapacity };
  }

  async #screen(groupSpec: GroupSpec): Promise<GroupAvailability> {
    const requestedGpus = extractRequestedGpusFromGroupSpecs([groupSpec]).map(({ vendor, model }) => `${vendor}/${model}`);
    return { group: groupSpec.name, requestedGpus, providersAbleToBid: await this.#countBidders(groupSpec) };
  }

  async #countBidders(groupSpec: GroupSpec): Promise<number | null> {
    try {
      return (await this.bidScreeningHttpService.findScreenedProviders(groupSpec)).length;
    } catch (error) {
      this.#logger.warn({ event: "ASSISTANT_BID_SCREENING_FAILED", error });
      return null;
    }
  }

  /** Console requires its auditors to have signed every placement attribute, so screening the group without them tells an unsigned attribute apart from missing capacity. */
  async #reasonForNoBidders(groupSpec: GroupSpec, requestedGpus: string[], gpuModelsWithFreeCapacity: string[] | null): Promise<string> {
    const attributes = groupSpec.requirements?.attributes ?? [];

    if (attributes.length > 0) {
      const biddersWithoutAttributes = await this.#countBidders({ ...groupSpec, requirements: { ...groupSpec.requirements!, attributes: [] } });
      if (biddersWithoutAttributes) {
        const attributeList = attributes.map(({ key, value }) => `${key}=${value}`).join(", ");
        return `No audited provider has signed the placement attributes ${attributeList}. Without them, ${biddersWithoutAttributes} providers could bid.`;
      }
    }

    if (requestedGpus.length > 0 && gpuModelsWithFreeCapacity && !requestedGpus.some(gpu => gpuModelsWithFreeCapacity.includes(gpu))) {
      return `No provider has ${requestedGpus.join(", ")} free right now.`;
    }

    return "No provider has these resources free right now.";
  }

  async #findAvailableGpuModels(): Promise<string[] | null> {
    try {
      return (await this.placementOptionsHttpService.findAvailableGpuModels()).map(({ vendor, model }) => `${vendor}/${model}`);
    } catch (error) {
      this.#logger.warn({ event: "ASSISTANT_PLACEMENT_OPTIONS_FAILED", error });
      return null;
    }
  }
}
