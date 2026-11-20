import { generateManifestVersion } from "@akashnetwork/chain-sdk";
import { Source } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { type GroupSpec, MsgCloseDeployment, MsgCreateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import type { Bid } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import { TxRaw } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { calculateFee, type SigningStargateClient } from "@cosmjs/stargate";
import { inject, singleton } from "tsyringe";

import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { CHAIN_SDK, type ChainSDK } from "@src/chain/providers/chain-sdk.provider";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { DEPLOYMENT_CONFIG, type DeploymentConfig } from "@src/deployment/config/config.provider";
import { BidScreeningHttpService } from "@src/deployment/services/bid-screening-http/bid-screening-http.service";
import { GpuBotSigningClientFactory } from "@src/deployment/services/gpu-bids-creator/gpu-bot-signing-client.factory";
import { findDeploymentBids } from "@src/deployment/utils/find-deployment-bids/find-deployment-bids";

/** Close settlement gas grows with bids placed between simulation and inclusion; matches tx-signer GAS_DEFAULT_MULTIPLIER (PR #3501). */
const GAS_MULTIPLIER = 2;

const DEPOSIT_UACT = "500000";

/** About one block, so a transaction the shared bot wallet signed elsewhere is committed and counted in the sequence the retry reads. */
const SEQUENCE_MISMATCH_RETRY_DELAY_MS = 7_000;

/** How long past its bid window a run may still hold its deployments open, covering screening, broadcast confirmations and the sequence retry. */
const MAX_RUN_OVERHEAD_MS = 10 * 60 * 1000;

export interface GpuCheckManifest {
  groups: Parameters<typeof generateManifestVersion>[0];
  groupSpecs: GroupSpec[];
  /** The model each group checks, in group sequence order, which is how the chain numbers the orders it opens. */
  groupModels: string[];
}

export interface GpuCheckDeployment {
  manifest: GpuCheckManifest;
}

export interface GpuCheckRunResult {
  dseq: string;
  bids: Bid[];
  /** Null when screening could not be asked, so nobody can be said to have missed the check. */
  screenedByGroup: string[][] | null;
}

export interface GpuCheckSession {
  client: SigningStargateClient;
  owner: string;
}

export interface GpuCheckRunOptions {
  /** Runs before the bid window, and the deployments are still closed when it throws, so a run that fails later is already accounted for. */
  onCreated?: (dseqs: string[]) => Promise<unknown>;
}

@singleton()
export class GpuCheckRunner {
  readonly #deploymentConfig: DeploymentConfig;
  readonly #chainSdk: ChainSDK;
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly config: BillingConfigService,
    @inject(CHAIN_SDK) chainSdk: ChainSDK,
    private readonly bidScreeningHttpService: BidScreeningHttpService,
    private readonly signingClientFactory: GpuBotSigningClientFactory,
    @inject(DEPLOYMENT_CONFIG) deploymentConfig: DeploymentConfig,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#deploymentConfig = deploymentConfig;
    this.#chainSdk = chainSdk;
    this.#logger = createLogger({ context: GpuCheckRunner.name });
  }

  async connect(): Promise<GpuCheckSession | null> {
    const mnemonic = this.#deploymentConfig.GPU_BOT_WALLET_MNEMONIC;
    if (!mnemonic || !this.config.get("RPC_NODE_ENDPOINT")) return null;

    const { address, client } = await this.signingClientFactory.connect(mnemonic);
    return { client, owner: address };
  }

  /** Each deployment's bids are read on their own, so one failed read rejects only that deployment's result. */
  async run(
    session: GpuCheckSession,
    deployments: GpuCheckDeployment[],
    { onCreated }: GpuCheckRunOptions = {}
  ): Promise<PromiseSettledResult<GpuCheckRunResult>[]> {
    if (deployments.length === 0) return [];

    const screenedByDeployment = await Promise.all(deployments.map(({ manifest }) => this.#screenGroups(manifest.groupSpecs)));
    const baseDseq = Date.now();
    const dseqs = deployments.map((_, index) => (baseDseq + index).toString());

    await this.#createDeployments(session, deployments, dseqs);
    this.#logger.info({ event: "GPU_CHECK_DEPLOYMENT_CREATED", dseqs });

    try {
      await onCreated?.(dseqs);
      await new Promise(resolve => setTimeout(resolve, this.#deploymentConfig.GPU_BOT_BID_WINDOW_SECONDS * 1000));
      return await Promise.allSettled(
        dseqs.map(async (dseq, index) => ({
          dseq,
          bids: await findDeploymentBids(this.#chainSdk, session.owner, dseq),
          screenedByGroup: screenedByDeployment[index]
        }))
      );
    } finally {
      await this.#closeDeployments(session, dseqs);
    }
  }

  /** Check deployments take their creation time in ms as dseq, so a younger one may still belong to a run waiting for bids. */
  isOlderThanAnyRun(dseq: string): boolean {
    const maxRunDurationMs = this.#deploymentConfig.GPU_BOT_BID_WINDOW_SECONDS * 1000 + MAX_RUN_OVERHEAD_MS;
    return Number(dseq) < Date.now() - maxRunDurationMs;
  }

  async closeDeployment({ client, owner }: GpuCheckSession, dseq: string) {
    const message = {
      typeUrl: `/${MsgCloseDeployment.$type}`,
      value: MsgCloseDeployment.fromPartial({ id: { owner, dseq } })
    };

    await this.#signAndBroadcast(owner, client, [message]);
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

  async #createDeployments({ client, owner }: GpuCheckSession, deployments: GpuCheckDeployment[], dseqs: string[]) {
    const messages = await Promise.all(
      deployments.map(async ({ manifest: { groups, groupSpecs } }, index) => ({
        typeUrl: `/${MsgCreateDeployment.$type}`,
        value: MsgCreateDeployment.fromPartial({
          id: { owner, dseq: dseqs[index] },
          groups: groupSpecs,
          hash: await generateManifestVersion(groups),
          deposit: { amount: { denom: "uact", amount: DEPOSIT_UACT }, sources: [Source.balance] }
        })
      }))
    );

    try {
      await this.#signAndBroadcast(owner, client, messages);
    } catch (error) {
      if (!isSequenceMismatch(error)) throw error;

      this.#logger.warn({ event: "GPU_CHECK_CREATE_SEQUENCE_MISMATCH", dseqs, error });
      await new Promise(resolve => setTimeout(resolve, SEQUENCE_MISMATCH_RETRY_DELAY_MS));
      await this.#signAndBroadcast(owner, client, messages);
    }
  }

  /** Each close is its own transaction because its gas grows with the bids placed, and a failed one is left to the next run's leftover cleanup so the bids already read are not lost. */
  async #closeDeployments(session: GpuCheckSession, dseqs: string[]) {
    for (const dseq of dseqs) {
      try {
        await this.closeDeployment(session, dseq);
        this.#logger.info({ event: "GPU_CHECK_DEPLOYMENT_CLOSED", dseq });
      } catch (error) {
        this.#logger.error({ event: "GPU_CHECK_DEPLOYMENT_CLOSE_FAILED", dseq, error });
      }
    }
  }

  async #signAndBroadcast(address: string, client: SigningStargateClient, messages: readonly EncodeObject[]) {
    const simulation = await client.simulate(address, messages, "");
    const fee = calculateFee(Math.round(simulation * GAS_MULTIPLIER), `${this.config.get("AVERAGE_GAS_PRICE")}uakt`);
    const txRaw = await client.sign(address, messages, fee, "");
    const txResult = await client.broadcastTx(Uint8Array.from(TxRaw.encode(txRaw).finish()));

    if (txResult.code !== 0) {
      this.#logger.error({ event: "GPU_CHECK_TX_FAILED", code: txResult.code, rawLog: txResult.rawLog });
      throw new Error(`Error broadcasting transaction: ${txResult.rawLog}`);
    }

    return txResult;
  }
}

export function resultOrThrow<T>(settled: PromiseSettledResult<T>): T {
  if (settled.status === "rejected") throw settled.reason;
  return settled.value;
}

/** The bot wallet also signs for the gpu-pricing-bot CronJob, and cosmjs reads the sequence when it signs, so the two can race for the same one. */
function isSequenceMismatch(error: unknown): boolean {
  return error instanceof Error && error.message.includes("account sequence mismatch");
}
