import type { SDLInput } from "@akashnetwork/chain-sdk";
import { generateManifest, generateManifestVersion, yaml as sdlYaml } from "@akashnetwork/chain-sdk";
import { Source } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { MsgCloseDeployment, MsgCreateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { TxRaw } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import { DirectSecp256k1HdWallet, EncodeObject, Registry } from "@cosmjs/proto-signing";
import { calculateFee, SigningStargateClient } from "@cosmjs/stargate";
import assert from "http-assert";
import { setTimeout as sleep } from "timers/promises";
import { inject, singleton } from "tsyringe";

import { InjectTypeRegistry } from "@src/billing/providers/type-registry.provider";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { CHAIN_SDK, type ChainSDK } from "@src/chain/providers/chain-sdk.provider";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { DEPLOYMENT_CONFIG, type DeploymentConfig } from "@src/deployment/config/config.provider";
import { type GpuModel, PlacementOptionsHttpService } from "@src/deployment/services/placement-options-http/placement-options-http.service";
import { sdlTemplate } from "./sdl-templates";

/** Close settlement gas grows with bids placed between simulation and inclusion; matches tx-signer GAS_DEFAULT_MULTIPLIER (PR #3501). */
const GAS_MULTIPLIER = 2;

/** The chain SDK's SDL schema accepts no other gpu vendor, so a deployment for any other would fail validation and stop the run. */
const SDL_GPU_VENDORS = new Set(["nvidia"]);

/** Model names come from what providers report, so anything an SDL attribute key cannot carry is skipped rather than written into the SDL. */
const SDL_GPU_MODEL_NAME = /^[\w.-]+$/;

@singleton()
export class GpuBidsCreatorService {
  readonly #deploymentConfig: DeploymentConfig;
  readonly #chainSdk: ChainSDK;
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly config: BillingConfigService,
    @inject(CHAIN_SDK) chainSdk: ChainSDK,
    private readonly placementOptionsHttpService: PlacementOptionsHttpService,
    @InjectTypeRegistry() private readonly typeRegistry: Registry,
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

    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(this.#deploymentConfig.GPU_BOT_WALLET_MNEMONIC, { prefix: "akash" });
    const [account] = await wallet.getAccounts();

    this.#logger.info({ event: "CREATING_GPU_BIDS", address: account.address });

    const client = await SigningStargateClient.connectWithSigner(this.config.get("RPC_NODE_ENDPOINT"), wallet, {
      registry: this.typeRegistry,
      broadcastTimeoutMs: 30_000
    });
    const balanceBefore = await client.getBalance(account.address, "uact");
    const balanceBeforeUAct = parseFloat(balanceBefore.amount);
    const act = Math.round((balanceBeforeUAct / 1_000_000) * 100) / 100;
    this.#logger.info({ event: "CLIENT_CONNECTED", balance: act });

    const availableGpuModels = await this.placementOptionsHttpService.findAvailableGpuModels();
    const gpuModels = availableGpuModels.filter(isExpressibleInSdl);

    if (gpuModels.length < availableGpuModels.length) {
      this.#logger.info({ event: "SKIPPING_UNSUPPORTED_GPU_MODELS", models: availableGpuModels.filter(model => !isExpressibleInSdl(model)) });
    }

    await this.createBidsForAllModels(gpuModels, client, account.address);

    const balanceAfter = await client.getBalance(account.address, "uact");
    const balanceAfterUAct = parseFloat(balanceAfter.amount);
    const diff = balanceBeforeUAct - balanceAfterUAct;

    this.#logger.info({ event: "GPU_BIDS_CREATED", cost: diff / 1_000_000 });
  }

  private async signAndBroadcast(address: string, client: SigningStargateClient, messages: readonly EncodeObject[]) {
    const simulation = await client.simulate(address, messages, "");

    const fee = calculateFee(Math.round(simulation * GAS_MULTIPLIER), `${this.config.get("AVERAGE_GAS_PRICE")}uakt`);

    const txRaw = await client.sign(address, messages, fee, "");

    const txRawBytes = Uint8Array.from(TxRaw.encode(txRaw).finish());
    const txResult = await client.broadcastTx(txRawBytes);

    if (txResult.code !== 0) {
      this.#logger.error(txResult);
      throw new Error(`Error broadcasting transaction: ${txResult.rawLog}`);
    }

    return txResult;
  }

  private async createBidsForAllModels(gpuModels: GpuModel[], client: SigningStargateClient, walletAddress: string) {
    this.#logger.info({ event: "CREATING_BIDS", modelCount: gpuModels.length });

    for (const gpuModel of gpuModels) {
      const dseq = Date.now().toString();
      this.#logger.info({ event: "CREATING_DEPLOYMENT", ...gpuModel });

      await this.createDeployment(client, this.getModelSdl(gpuModel), walletAddress, dseq);
      this.#logger.info({ event: "DEPLOYMENT_CREATED" });

      await sleep(30_000);

      const bids = await this.#chainSdk.akash.market.v1beta5.getBids({
        filters: {
          owner: walletAddress,
          dseq
        }
      });

      this.#logger.info({ event: "DEPLOYMENT_CLOSING", bidsCount: bids?.bids.length });
      await this.closeDeployment(client, walletAddress, dseq);
      this.#logger.info({ event: "DEPLOYMENT_CLOSED" });

      await sleep(10_000);
    }

    this.#logger.info({ event: "BIDS_CREATED" });
  }

  private async createDeployment(client: SigningStargateClient, sdlStr: string, owner: string, dseq: string) {
    const sdlInput = sdlYaml.template<SDLInput>(sdlStr);
    const manifest = generateManifest(sdlInput);
    assert(manifest.ok, 400, `Invalid SDL: ${manifest.ok === false ? manifest.value.map(e => e.message).join(", ") : ""}`);

    const manifestVersion = await generateManifestVersion(manifest.value.groups);
    const message = {
      typeUrl: `/${MsgCreateDeployment.$type}`,
      value: MsgCreateDeployment.fromPartial({
        id: {
          owner: owner,
          dseq: dseq
        },
        groups: manifest.value.groupSpecs,
        hash: manifestVersion,
        deposit: {
          amount: {
            denom: "uact",
            amount: "500000" // 0.5 ACT
          },
          sources: [Source.balance]
        }
      })
    };

    await this.signAndBroadcast(owner, client, [message]);
  }

  private async closeDeployment(client: SigningStargateClient, owner: string, dseq: string) {
    const message = {
      typeUrl: `/${MsgCloseDeployment.$type}`,
      value: MsgCloseDeployment.fromPartial({
        id: {
          owner: owner,
          dseq: dseq
        }
      })
    };

    await this.signAndBroadcast(owner, client, [message]);
  }

  private getModelSdl({ vendor, model }: GpuModel) {
    return sdlTemplate.replace("<VENDOR>", vendor).replace("<MODEL>", model);
  }
}

function isExpressibleInSdl({ vendor, model }: GpuModel): boolean {
  return SDL_GPU_VENDORS.has(vendor) && SDL_GPU_MODEL_NAME.test(model);
}
