import { generateManifest, generateManifestVersion } from "@akashnetwork/chain-sdk";
import { Source } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { type GroupSpec, MsgCloseDeployment, MsgCreateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import type { Bid } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import { TxRaw } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { calculateFee, type SigningStargateClient } from "@cosmjs/stargate";
import { subDays } from "date-fns";
import chunk from "lodash/chunk";
import { inject, singleton } from "tsyringe";

import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { CHAIN_SDK, type ChainSDK } from "@src/chain/providers/chain-sdk.provider";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { DEPLOYMENT_CONFIG, type DeploymentConfig } from "@src/deployment/config/config.provider";
import { type GpuBidCheckInsert, GpuBidCheckRepository } from "@src/deployment/repositories/gpu-bid-check/gpu-bid-check.repository";
import { BidScreeningHttpService } from "@src/deployment/services/bid-screening-http/bid-screening-http.service";
import { type GpuModel, PlacementOptionsHttpService } from "@src/deployment/services/placement-options-http/placement-options-http.service";
import { GpuBotSigningClientFactory } from "./gpu-bot-signing-client.factory";
import { buildGpuCheckSdl, GPU_CHECK_SHAPES, type GpuCheck, toPlacementName } from "./gpu-check-sdl";

/** Close settlement gas grows with bids placed between simulation and inclusion; matches tx-signer GAS_DEFAULT_MULTIPLIER (PR #3501). */
const GAS_MULTIPLIER = 2;

/** The chain SDK's SDL schema accepts no other gpu vendor, so a deployment for any other would fail validation and stop the run. */
const SDL_GPU_VENDOR = "nvidia";

/** Model names come from what providers report, so anything an SDL attribute key cannot carry is skipped rather than written into the SDL. */
const SDL_GPU_MODEL_NAME = /^[\w.-]+$/;

/** The chain refuses a deployment with more placement groups than this. */
const MAX_GROUPS_PER_DEPLOYMENT = 20;

const MODELS_PER_DEPLOYMENT = MAX_GROUPS_PER_DEPLOYMENT / GPU_CHECK_SHAPES.length;

const DEPOSIT_UACT = "500000";

const BIDS_PAGE_SIZE = 1000n;

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

interface GpuCheckManifest {
  groups: Parameters<typeof generateManifestVersion>[0];
  groupSpecs: GroupSpec[];
  /** The model each group checks, in group sequence order, which is how the chain numbers the orders it opens. */
  groupModels: string[];
}

@singleton()
export class GpuBidsCreatorService {
  readonly #deploymentConfig: DeploymentConfig;
  readonly #chainSdk: ChainSDK;
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly config: BillingConfigService,
    @inject(CHAIN_SDK) chainSdk: ChainSDK,
    private readonly placementOptionsHttpService: PlacementOptionsHttpService,
    private readonly bidScreeningHttpService: BidScreeningHttpService,
    private readonly gpuBidCheckRepository: GpuBidCheckRepository,
    private readonly signingClientFactory: GpuBotSigningClientFactory,
    @inject(DEPLOYMENT_CONFIG) deploymentConfig: DeploymentConfig,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#deploymentConfig = deploymentConfig;
    this.#chainSdk = chainSdk;
    this.#logger = createLogger({ context: GpuBidsCreatorService.name });
  }

  async createGpuBids() {
    if (!this.#deploymentConfig.GPU_BOT_WALLET_MNEMONIC) throw new Error("The env variable GPU_BOT_WALLET_MNEMONIC is not set.");
    if (!this.config.get("RPC_NODE_ENDPOINT")) throw new Error("The env variable RPC_NODE_ENDPOINT is not set.");

    const { address, client } = await this.signingClientFactory.connect(this.#deploymentConfig.GPU_BOT_WALLET_MNEMONIC);
    const feeBalanceBefore = await this.#getFeeBalance(client, address);
    this.#logger.info({ event: "CREATING_GPU_BIDS", address, feeBalance: feeBalanceBefore / 1_000_000 });
    await this.#closeLeftoverDeployments(client, address);

    const models = await this.#findCheckableModels();
    const batches = chunk(models, MODELS_PER_DEPLOYMENT);
    const results: GpuCheckBatchResult[] = [];
    const failures: unknown[] = [];

    for (const batch of batches) {
      try {
        results.push(await this.#checkBatch(batch, client, address));
      } catch (error) {
        failures.push(error);
        this.#logger.error({ event: "GPU_CHECK_BATCH_FAILED", models: batch, error });
      }
    }

    await this.gpuBidCheckRepository.deleteCheckedBefore(subDays(new Date(), CHECK_RETENTION_DAYS));

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
  async #closeLeftoverDeployments(client: SigningStargateClient, owner: string): Promise<void> {
    let dseqs: string[];
    try {
      dseqs = await this.#findActiveDeploymentDseqs(owner);
    } catch (error) {
      this.#logger.error({ event: "GPU_CHECK_LEFTOVER_DEPLOYMENTS_UNREAD", error });
      return;
    }

    for (const dseq of dseqs) {
      try {
        await this.#closeDeployment(client, owner, dseq);
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

  async #findCheckableModels(): Promise<string[]> {
    const availableModels = await this.placementOptionsHttpService.findAvailableGpuModels();
    const checkableModels = availableModels.filter(isExpressibleInSdl);

    if (checkableModels.length < availableModels.length) {
      this.#logger.info({ event: "SKIPPING_UNSUPPORTED_GPU_MODELS", models: availableModels.filter(model => !isExpressibleInSdl(model)) });
    }

    return checkableModels.map(({ model }) => model);
  }

  async #checkBatch(models: string[], client: SigningStargateClient, owner: string): Promise<GpuCheckBatchResult> {
    const dseq = Date.now().toString();
    const manifest = this.#buildManifest(models.flatMap(model => GPU_CHECK_SHAPES.map(shape => ({ model, shape }))));
    const screenedByGroup = await this.#screenGroups(manifest.groupSpecs);

    await this.#createDeployment(client, owner, dseq, manifest);
    this.#logger.info({ event: "GPU_CHECK_DEPLOYMENT_CREATED", dseq, models });

    try {
      await new Promise(resolve => setTimeout(resolve, this.#deploymentConfig.GPU_BOT_BID_WINDOW_SECONDS * 1000));
      const bids = await this.#findBids(owner, dseq);
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
    } finally {
      await this.#closeDeployment(client, owner, dseq);
      this.#logger.info({ event: "GPU_CHECK_DEPLOYMENT_CLOSED", dseq });
    }
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

  /** Screens right before the deployment goes out, so the providers expected to bid are the ones that could at that moment. */
  async #screenGroups(groupSpecs: GroupSpec[]): Promise<string[][] | null> {
    try {
      return await Promise.all(groupSpecs.map(groupSpec => this.bidScreeningHttpService.findScreenedProviders(groupSpec)));
    } catch (error) {
      this.#logger.warn({ event: "GPU_CHECK_SCREENING_FAILED", error });
      return null;
    }
  }

  async #createDeployment(client: SigningStargateClient, owner: string, dseq: string, { groups, groupSpecs }: GpuCheckManifest) {
    const message = {
      typeUrl: `/${MsgCreateDeployment.$type}`,
      value: MsgCreateDeployment.fromPartial({
        id: { owner, dseq },
        groups: groupSpecs,
        hash: await generateManifestVersion(groups),
        deposit: { amount: { denom: "uact", amount: DEPOSIT_UACT }, sources: [Source.balance] }
      })
    };

    await this.#signAndBroadcast(owner, client, [message]);
  }

  async #findBids(owner: string, dseq: string): Promise<Bid[]> {
    const bids: Bid[] = [];
    let key: Uint8Array | undefined;

    do {
      const response = await this.#chainSdk.akash.market.v1beta5.getBids({ filters: { owner, dseq }, pagination: { key, limit: BIDS_PAGE_SIZE } });
      bids.push(...response.bids.flatMap(({ bid }) => (bid ? [bid] : [])));
      key = response.pagination?.nextKey.length ? response.pagination.nextKey : undefined;
    } while (key);

    return bids;
  }

  async #closeDeployment(client: SigningStargateClient, owner: string, dseq: string) {
    const message = {
      typeUrl: `/${MsgCloseDeployment.$type}`,
      value: MsgCloseDeployment.fromPartial({ id: { owner, dseq } })
    };

    await this.#signAndBroadcast(owner, client, [message]);
  }

  async #signAndBroadcast(address: string, client: SigningStargateClient, messages: readonly EncodeObject[]) {
    const simulation = await client.simulate(address, messages, "");
    const fee = calculateFee(Math.round(simulation * GAS_MULTIPLIER), `${this.config.get("AVERAGE_GAS_PRICE")}uakt`);
    const txRaw = await client.sign(address, messages, fee, "");
    const txResult = await client.broadcastTx(Uint8Array.from(TxRaw.encode(txRaw).finish()));

    if (txResult.code !== 0) {
      this.#logger.error(txResult);
      throw new Error(`Error broadcasting transaction: ${txResult.rawLog}`);
    }

    return txResult;
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
