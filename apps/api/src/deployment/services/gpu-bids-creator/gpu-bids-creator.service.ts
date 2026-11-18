import { generateManifest } from "@akashnetwork/chain-sdk";
import type { Bid } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import type { SigningStargateClient } from "@cosmjs/stargate";
import { subDays } from "date-fns";
import chunk from "lodash/chunk";
import { inject, singleton } from "tsyringe";

import { CHAIN_SDK, type ChainSDK } from "@src/chain/providers/chain-sdk.provider";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { type GpuBidCheckInsert, GpuBidCheckRepository } from "@src/deployment/repositories/gpu-bid-check/gpu-bid-check.repository";
import {
  type GpuCheckManifest,
  GpuCheckRunner,
  type GpuCheckRunResult,
  type GpuCheckSession
} from "@src/deployment/services/gpu-check-runner/gpu-check-runner.service";
import { type GpuModel, PlacementOptionsHttpService } from "@src/deployment/services/placement-options-http/placement-options-http.service";
import { buildGpuCheckSdl, GPU_CHECK_SHAPES, type GpuCheck, toPlacementName } from "./gpu-check-sdl";

/** The chain SDK's SDL schema accepts no other gpu vendor, so a deployment for any other would fail validation and stop the run. */
const SDL_GPU_VENDOR = "nvidia";

/** Model names come from what providers report, so anything an SDL attribute key cannot carry is skipped rather than written into the SDL. */
const SDL_GPU_MODEL_NAME = /^[\w.-]+$/;

/** The chain refuses a deployment with more placement groups than this. */
const MAX_GROUPS_PER_DEPLOYMENT = 20;

const MODELS_PER_DEPLOYMENT = MAX_GROUPS_PER_DEPLOYMENT / GPU_CHECK_SHAPES.length;

/** One page per run is enough, since each run closes what it finds and leaves the rest to the next. */
const LEFTOVER_DEPLOYMENTS_PAGE_SIZE = 100n;

const CHECK_RETENTION_DAYS = 30;

interface MissedModel {
  model: string;
  providers: string[];
}

interface GpuCheckBatchResult {
  bidCount: number;
  missed: MissedModel[];
}

interface ModelOutcome {
  model: string;
  /** Null when screening could not be asked, so nobody can be said to have missed the check. */
  screened: Set<string> | null;
  bidders: Set<string>;
}

@singleton()
export class GpuBidsCreatorService {
  readonly #chainSdk: ChainSDK;
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    @inject(CHAIN_SDK) chainSdk: ChainSDK,
    private readonly placementOptionsHttpService: PlacementOptionsHttpService,
    private readonly gpuBidCheckRepository: GpuBidCheckRepository,
    private readonly gpuCheckRunner: GpuCheckRunner,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#chainSdk = chainSdk;
    this.#logger = createLogger({ context: GpuBidsCreatorService.name });
  }

  async createGpuBids() {
    const session = await this.gpuCheckRunner.connect();
    if (!session) throw new Error("The env variables GPU_BOT_WALLET_MNEMONIC and RPC_NODE_ENDPOINT must be set.");

    const { client, owner: address } = session;
    const feeBalanceBefore = await this.#getFeeBalance(client, address);
    this.#logger.info({ event: "CREATING_GPU_BIDS", address, feeBalance: feeBalanceBefore / 1_000_000 });
    await this.#closeLeftoverDeployments(session);

    const models = await this.#findCheckableModels();
    const batches = chunk(models, MODELS_PER_DEPLOYMENT);
    const results: GpuCheckBatchResult[] = [];
    const failures: unknown[] = [];
    const manifests = batches.map(batch => this.#buildManifest(batch.flatMap(model => GPU_CHECK_SHAPES.map(shape => ({ model, shape })))));

    try {
      const runResults = await this.gpuCheckRunner.run(
        session,
        manifests.map(manifest => ({ manifest }))
      );

      for (const [index, batch] of batches.entries()) {
        try {
          results.push(await this.#recordBatch(batch, manifests[index], runResults[index]));
        } catch (error) {
          failures.push(error);
          this.#logger.error({ event: "GPU_CHECK_BATCH_FAILED", models: batch, error });
        }
      }
    } catch (error) {
      failures.push(...batches.map(() => error));
      this.#logger.error({ event: "GPU_CHECK_RUN_FAILED", models, error });
    }

    await this.#deleteExpiredChecks();

    const feeBalanceAfter = await this.#getFeeBalance(client, address);
    this.#logger.info({
      event: "GPU_BIDS_CREATED",
      gpuCount: models.length,
      deploymentCount: results.length,
      failedDeploymentCount: failures.length,
      bidCount: results.reduce((total, { bidCount }) => total + bidCount, 0),
      missed: results.flatMap(({ missed }) => missed),
      feeAkt: (feeBalanceBefore - feeBalanceAfter) / 1_000_000
    });

    if (failures.length > 0) {
      throw new AggregateError(failures, `${failures.length} of ${batches.length} gpu check deployments failed`);
    }
  }

  /** A run that lost track of its deployment, to a broadcast timeout or a pod stopped mid-check, left it open with its deposit, so the next run closes it. */
  async #closeLeftoverDeployments(session: GpuCheckSession): Promise<void> {
    let dseqs: string[];
    try {
      dseqs = await this.#findActiveDeploymentDseqs(session.owner);
    } catch (error) {
      this.#logger.error({ event: "GPU_CHECK_LEFTOVER_DEPLOYMENTS_UNREAD", error });
      return;
    }

    for (const dseq of dseqs) {
      try {
        await this.gpuCheckRunner.closeDeployment(session, dseq);
        this.#logger.info({ event: "GPU_CHECK_LEFTOVER_DEPLOYMENT_CLOSED", dseq });
      } catch (error) {
        this.#logger.error({ event: "GPU_CHECK_LEFTOVER_DEPLOYMENT_CLOSE_FAILED", dseq, error });
      }
    }
  }

  async #findActiveDeploymentDseqs(owner: string): Promise<string[]> {
    const { deployments } = await this.#chainSdk.akash.deployment.v1beta4.getDeployments({
      filters: { owner, state: "active" },
      pagination: { limit: LEFTOVER_DEPLOYMENTS_PAGE_SIZE }
    });

    return deployments.flatMap(({ deployment }) => (deployment?.id ? [deployment.id.dseq.toString()] : []));
  }

  async #deleteExpiredChecks(): Promise<void> {
    try {
      await this.gpuBidCheckRepository.deleteCheckedBefore(subDays(new Date(), CHECK_RETENTION_DAYS));
    } catch (error) {
      this.#logger.error({ event: "GPU_CHECK_RETENTION_CLEANUP_FAILED", error });
    }
  }

  async #findCheckableModels(): Promise<string[]> {
    const availableModels = await this.placementOptionsHttpService.findAvailableGpuModels();
    const checkableModels = availableModels.filter(isExpressibleInSdl);

    if (checkableModels.length < availableModels.length) {
      this.#logger.info({ event: "SKIPPING_UNSUPPORTED_GPU_MODELS", models: availableModels.filter(model => !isExpressibleInSdl(model)) });
    }

    return checkableModels.map(({ model }) => model);
  }

  async #recordBatch(models: string[], manifest: GpuCheckManifest, { dseq, bids, screenedByGroup }: GpuCheckRunResult): Promise<GpuCheckBatchResult> {
    const outcomes = toModelOutcomes(models, manifest.groupModels, screenedByGroup, bids);

    const checkedAt = new Date();
    await this.gpuBidCheckRepository.insertMany(outcomes.flatMap(outcome => toCheckRows(outcome, dseq, checkedAt)));

    const missed = outcomes.map(toMissedModel).filter(({ providers }) => providers.length > 0);
    this.#logger.info({
      event: "GPU_CHECK_BIDS_RECEIVED",
      dseq,
      models: outcomes.map(({ model, screened, bidders }) => ({ model, screenedCount: screened?.size ?? null, bidders: [...bidders] })),
      missed
    });

    return { bidCount: bids.length, missed };
  }

  #buildManifest(checks: GpuCheck[]): GpuCheckManifest {
    const placementModels = new Map(checks.map(({ model }, index) => [toPlacementName(index), model]));
    const manifest = generateManifest(buildGpuCheckSdl(checks));

    if (!manifest.ok) {
      throw new Error(`Invalid gpu check SDL: ${manifest.value.map(error => error.message).join(", ")}`);
    }

    const { groups, groupSpecs } = manifest.value;
    return { groups, groupSpecs, groupModels: groupSpecs.map(({ name }) => placementModels.get(name) ?? name) };
  }

  /** Fees are paid in uakt while the deposit is in uact and comes back on close, so the uakt balance is what a run costs. */
  async #getFeeBalance(client: SigningStargateClient, address: string): Promise<number> {
    const { amount } = await client.getBalance(address, "uakt");
    return parseFloat(amount);
  }
}

function isExpressibleInSdl({ vendor, model }: GpuModel): boolean {
  return vendor === SDL_GPU_VENDOR && SDL_GPU_MODEL_NAME.test(model);
}

/** A model counts as bid on by a provider that bid on any of its shapes, so declining only the tiny pricing order is not a miss. */
function toModelOutcomes(models: string[], groupModels: string[], screenedByGroup: string[][] | null, bids: Bid[]): ModelOutcome[] {
  return models.map(model => {
    const groupIndexes = groupModels.flatMap((groupModel, index) => (groupModel === model ? [index] : []));
    const screened = screenedByGroup && new Set(groupIndexes.flatMap(index => screenedByGroup[index]));
    const bidders = new Set(bids.flatMap(({ id }) => (id && groupIndexes.includes(id.gseq - 1) ? [id.provider] : [])));

    return { model, screened, bidders };
  });
}

function toCheckRows({ model, screened, bidders }: ModelOutcome, dseq: string, checkedAt: Date): GpuBidCheckInsert[] {
  const providers = new Set([...(screened ?? []), ...bidders]);

  return [...providers].map(provider => ({
    provider,
    vendor: SDL_GPU_VENDOR,
    model,
    source: "pricing-bot",
    dseq,
    screened: screened?.has(provider) ?? false,
    bid: bidders.has(provider),
    checkedAt
  }));
}

function toMissedModel({ model, screened, bidders }: ModelOutcome): MissedModel {
  return { model, providers: [...(screened ?? [])].filter(provider => !bidders.has(provider)) };
}
