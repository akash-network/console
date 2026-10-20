import { generateManifest, generateManifestVersion } from "@akashnetwork/chain-sdk";
import { Source } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { MsgCloseDeployment, MsgCreateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import type { Bid } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import { TxRaw } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { calculateFee, type SigningStargateClient } from "@cosmjs/stargate";
import chunk from "lodash/chunk";
import { inject, singleton } from "tsyringe";

import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { CHAIN_SDK, type ChainSDK } from "@src/chain/providers/chain-sdk.provider";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { DEPLOYMENT_CONFIG, type DeploymentConfig } from "@src/deployment/config/config.provider";
import { type GpuModel, PlacementOptionsHttpService } from "@src/deployment/services/placement-options-http/placement-options-http.service";
import { GpuBotSigningClientFactory } from "./gpu-bot-signing-client.factory";
import { buildGpuCheckSdl, toPlacementName } from "./gpu-check-sdl";

/** Close settlement gas grows with bids placed between simulation and inclusion; matches tx-signer GAS_DEFAULT_MULTIPLIER (PR #3501). */
const GAS_MULTIPLIER = 2;

/** The chain SDK's SDL schema accepts no other gpu vendor, so a deployment for any other would fail validation and stop the run. */
const SDL_GPU_VENDOR = "nvidia";

/** Model names come from what providers report, so anything an SDL attribute key cannot carry is skipped rather than written into the SDL. */
const SDL_GPU_MODEL_NAME = /^[\w.-]+$/;

/** The chain refuses a deployment with more placement groups than this. */
const MAX_GROUPS_PER_DEPLOYMENT = 20;

const DEPOSIT_UACT = "500000";

const BIDS_PAGE_SIZE = 1000n;

/** One page per run is enough, since each run closes what it finds and leaves the rest to the next. */
const LEFTOVER_DEPLOYMENTS_PAGE_SIZE = 100n;

interface GpuCheckBatchResult {
  dseq: string;
  bidCount: number;
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
    const batches = chunk(models, MAX_GROUPS_PER_DEPLOYMENT);
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

    const feeBalanceAfter = await this.#getFeeBalance(client, address);
    this.#logger.info({
      event: "GPU_BIDS_CREATED",
      gpuCount: models.length,
      deploymentCount: results.length,
      failedDeploymentCount: failures.length,
      bidCount: results.reduce((total, { bidCount }) => total + bidCount, 0),
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
    const groupModels = await this.#createDeployment(client, owner, dseq, models);
    this.#logger.info({ event: "GPU_CHECK_DEPLOYMENT_CREATED", dseq, models });

    try {
      await new Promise(resolve => setTimeout(resolve, this.#deploymentConfig.GPU_BOT_BID_WINDOW_SECONDS * 1000));
      const bids = await this.#findBids(owner, dseq);
      this.#logger.info({
        event: "GPU_CHECK_BIDS_RECEIVED",
        dseq,
        bids: groupModels.map((model, index) => ({ model, bidCount: bids.filter(bid => bid.id?.gseq === index + 1).length }))
      });

      return { dseq, bidCount: bids.length };
    } finally {
      await this.#closeDeployment(client, owner, dseq);
      this.#logger.info({ event: "GPU_CHECK_DEPLOYMENT_CLOSED", dseq });
    }
  }

  /** Resolves to the model each group checks, in group sequence order, which is how the chain numbers the orders it opens. */
  async #createDeployment(client: SigningStargateClient, owner: string, dseq: string, models: string[]): Promise<string[]> {
    const placementModels = new Map(models.map((model, index) => [toPlacementName(index), model]));
    const manifest = generateManifest(buildGpuCheckSdl(models));

    if (!manifest.ok) {
      throw new Error(`Invalid gpu check SDL: ${manifest.value.map(error => error.message).join(", ")}`);
    }

    const message = {
      typeUrl: `/${MsgCreateDeployment.$type}`,
      value: MsgCreateDeployment.fromPartial({
        id: { owner, dseq },
        groups: manifest.value.groupSpecs,
        hash: await generateManifestVersion(manifest.value.groups),
        deposit: { amount: { denom: "uact", amount: DEPOSIT_UACT }, sources: [Source.balance] }
      })
    };

    await this.#signAndBroadcast(owner, client, [message]);

    return manifest.value.groupSpecs.map(({ name }) => placementModels.get(name) ?? name);
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
