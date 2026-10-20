import { subDays, subHours } from "date-fns";
import maxBy from "lodash/maxBy";
import uniqBy from "lodash/uniqBy";
import { inject, singleton } from "tsyringe";
import { z } from "zod";

import type { BidScreeningRequest } from "@src/bid-screening/http-schemas/bid-screening.schema";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { type CheckedGpuModel, GpuBidCheckRepository, type PricingBotCheckHistory } from "@src/deployment/repositories/gpu-bid-check/gpu-bid-check.repository";

const NOT_BIDDING_WINDOW_HOURS = 48;

const LAST_BID_WINDOW_DAYS = 30;

/** Fewer checks than this cannot tell a provider that stopped bidding from one that missed a bid window by chance. */
const MIN_CHECKS_TO_FLAG = 3;

/** Bounds the history query an unauthenticated request can ask for; the configure page asks for one model per gpu service. */
const MAX_REQUESTED_GPU_MODELS = 10;

const GPU_MODEL_ATTRIBUTE_KEY = /^vendor\/([^/]+)\/model\/([^/]+)/;

const ScreeningSchema = z.object({ providers: z.array(z.object({ owner: z.string() }).passthrough()) }).passthrough();

type Screening = z.infer<typeof ScreeningSchema>;

@singleton()
export class ProviderGpuBiddingService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly gpuBidCheckRepository: GpuBidCheckRepository,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: ProviderGpuBiddingService.name });
  }

  /** Leaves the screening as it is when the history cannot be read, which the configure page treats as no provider to warn about. */
  async addBidding(screening: unknown, models: CheckedGpuModel[]): Promise<unknown> {
    const parsed = ScreeningSchema.safeParse(screening);
    if (!parsed.success || models.length > MAX_REQUESTED_GPU_MODELS) return screening;

    try {
      return await this.#addBidding(parsed.data, models);
    } catch (error) {
      this.#logger.warn({ event: "PROVIDER_GPU_BIDDING_UNAVAILABLE", error });
      return screening;
    }
  }

  async #addBidding(screening: Screening, models: CheckedGpuModel[]): Promise<Screening> {
    const now = new Date();
    const history = await this.gpuBidCheckRepository.findPricingBotHistory({
      providers: screening.providers.map(({ owner }) => owner),
      models,
      since: subHours(now, NOT_BIDDING_WINDOW_HOURS),
      lastBidSince: subDays(now, LAST_BID_WINDOW_DAYS)
    });

    return {
      ...screening,
      providers: screening.providers.map(provider => ({
        ...provider,
        ...toBidding(history.filter(({ provider: owner }) => owner === provider.owner))
      }))
    };
  }
}

export function findRequestedGpuModels({ resources }: BidScreeningRequest): CheckedGpuModel[] {
  const models = resources.filter(({ resource }) => resource.gpu.units.val > 0n).flatMap(({ resource }) => findPinnedGpuModels(resource.gpu.attributes ?? []));

  return uniqBy(models, ({ vendor, model }) => `${vendor}/${model}`);
}

/** A gpu open to any model, or to a wildcard name, can be served with models no check covers, so it names none to flag on. */
function findPinnedGpuModels(attributes: Array<{ key: string; value: string }>): CheckedGpuModel[] {
  const models = attributes.filter(({ value }) => value === "true").map(({ key }) => toCheckedGpuModel(key));
  const pinned = models.filter(model => model !== null);
  return pinned.length === models.length ? pinned : [];
}

function toCheckedGpuModel(key: string): CheckedGpuModel | null {
  const match = GPU_MODEL_ATTRIBUTE_KEY.exec(key);
  return match && !match[2].includes("*") ? { vendor: match[1], model: match[2] } : null;
}

/** A bid on any requested model keeps the provider unflagged, since it can serve the request with that one. */
function toBidding(history: PricingBotCheckHistory[]) {
  const lastBidAt = maxBy(
    history.flatMap(({ lastBidAt }) => (lastBidAt ? [lastBidAt] : [])),
    date => date.getTime()
  );

  return {
    isNotBidding: history.some(wasListedOnEnoughChecks) && !history.some(({ bidSinceCutoff }) => bidSinceCutoff),
    lastCheckBidAt: lastBidAt?.toISOString() ?? null
  };
}

function wasListedOnEnoughChecks({ checks, screenedChecks }: PricingBotCheckHistory): boolean {
  return checks >= MIN_CHECKS_TO_FLAG && screenedChecks === checks;
}
