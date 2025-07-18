import { MsgCloseDeployment, MsgCreateDeployment } from "@akashnetwork/akash-api/v1beta3";
import { SDL } from "@akashnetwork/akashjs/build/sdl";
import { getAkashTypeRegistry } from "@akashnetwork/akashjs/build/stargate";
import { BidHttpService } from "@akashnetwork/http-sdk";
import { LoggerService } from "@akashnetwork/logging";
import { DirectSecp256k1HdWallet, EncodeObject, Registry } from "@cosmjs/proto-signing";
import { calculateFee, SigningStargateClient } from "@cosmjs/stargate";
import axios from "axios";
import { TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import pick from "lodash/pick";
import { singleton } from "tsyringe";

import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { GpuService } from "@src/gpu/services/gpu.service";
import { apiNodeUrl } from "@src/utils/constants";
import { sleep } from "@src/utils/delay";
import { env } from "@src/utils/env";
import { sdlTemplateWithRam, sdlTemplateWithRamAndInterface } from "./sdl-templates";

@singleton()
export class GpuBidsCreatorService {
  private readonly logger = LoggerService.forContext(GpuBidsCreatorService.name);

  constructor(
    private readonly config: BillingConfigService,
    private readonly bidHttpService: BidHttpService,
    private readonly gpuService: GpuService
  ) {}

  async createGpuBids() {
    if (!env.GPU_BOT_WALLET_MNEMONIC) throw new Error("The env variable GPU_BOT_WALLET_MNEMONIC is not set.");
    if (!this.config.get("RPC_NODE_ENDPOINT")) throw new Error("The env variable RPC_NODE_ENDPOINT is not set.");

    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(env.GPU_BOT_WALLET_MNEMONIC, { prefix: "akash" });
    const [account] = await wallet.getAccounts();

    this.logger.info({ event: "CREATING_GPU_BIDS", address: account.address });

    const myRegistry = new Registry([...getAkashTypeRegistry()]);

    const client = await SigningStargateClient.connectWithSigner(this.config.get("RPC_NODE_ENDPOINT"), wallet, {
      registry: myRegistry,
      broadcastTimeoutMs: 30_000
    });
    const balanceBefore = await client.getBalance(account.address, "uakt");
    const balanceBeforeUAkt = parseFloat(balanceBefore.amount);
    const akt = Math.round((balanceBeforeUAkt / 1_000_000) * 100) / 100;
    this.logger.info({ event: "CLIENT_CONNECTED", balance: akt });

    const gpuModels = await this.gpuService.getGpuList();

    await this.createBidsForAllModels(gpuModels, client, account.address, false);
    await this.createBidsForAllModels(gpuModels, client, account.address, true);

    const balanceAfter = await client.getBalance(account.address, "uakt");
    const balanceAfterUAkt = parseFloat(balanceAfter.amount);
    const diff = balanceBeforeUAkt - balanceAfterUAkt;

    this.logger.info({ event: "GPU_BIDS_CREATED", cost: diff / 1_000_000 });
  }

  private async signAndBroadcast(address: string, client: SigningStargateClient, messages: readonly EncodeObject[]) {
    const simulation = await client.simulate(address, messages, "");

    const fee = calculateFee(Math.round(simulation * 1.35), `${this.config.get("AVERAGE_GAS_PRICE")}uakt`);

    const txRaw = await client.sign(address, messages, fee, "");

    const txRawBytes = Uint8Array.from(TxRaw.encode(txRaw).finish());
    const txResult = await client.broadcastTx(txRawBytes);

    if (txResult.code !== 0) {
      this.logger.error(txResult);
      throw new Error(`Error broadcasting transaction: ${txResult.rawLog}`);
    }

    return txResult;
  }

  private async createBidsForAllModels(
    gpuModels: Awaited<ReturnType<typeof GpuService.prototype.getGpuList>>,
    client: SigningStargateClient,
    walletAddress: string,
    includeInterface: boolean
  ) {
    const vendors = Object.keys(gpuModels.gpus.details).filter(x => x !== "<UNKNOWN>");

    const models = vendors.flatMap(vendor => gpuModels.gpus.details[vendor].map(x => ({ vendor, ...x })));

    models.sort(
      (a, b) => a.vendor.localeCompare(b.vendor) || a.model.localeCompare(b.model) || a.ram.localeCompare(b.ram) || a.interface.localeCompare(b.interface)
    );

    this.logger.info({ event: "CREATING_BIDS", includeInterface });

    const doneModels: string[] = [];
    for (const model of models) {
      const dseq = (await this.getCurrentHeight()).toString();
      this.logger.info({ event: "CREATING_DEPLOYMENT", ...pick(model, ["vendor", "model", "ram", "interface"]) });

      if (doneModels.includes(model.model + "-" + model.ram)) {
        this.logger.info({ event: "SKIPPING_DEPLOYMENT", ...pick(model, ["model", "ram"]) });
        continue;
      }

      const gpuSdl = this.getModelSdl(model.vendor, model.model, model.ram, includeInterface ? model.interface : undefined);

      await this.createDeployment(client, gpuSdl, walletAddress, dseq);
      this.logger.info({ event: "DEPLOYMENT_CREATED" });

      await sleep(30_000);

      const bids = await this.bidHttpService.list(walletAddress, dseq);

      this.logger.info({ event: "DEPLOYMENT_CLOSING", bidsCount: bids.length });
      await this.closeDeployment(client, walletAddress, dseq);
      this.logger.info({ event: "DEPLOYMENT_CLOSED" });

      if (!includeInterface) {
        doneModels.push(model.model + "-" + model.ram);
      }

      await sleep(10_000);
    }

    this.logger.info({ event: "BIDS_CREATED" });
  }

  private async createDeployment(client: SigningStargateClient, sdlStr: string, owner: string, dseq: string) {
    const sdl = SDL.fromString(sdlStr, "beta3");

    const manifestVersion = await sdl.manifestVersion();
    const message = {
      typeUrl: `/akash.deployment.v1beta3.MsgCreateDeployment`,
      value: MsgCreateDeployment.fromPartial({
        id: {
          owner: owner,
          dseq: dseq
        },
        groups: sdl.groups(),
        version: manifestVersion,
        deposit: {
          denom: "uakt",
          amount: "500000" // 0.5 AKT
        },
        depositor: owner
      })
    };

    await this.signAndBroadcast(owner, client, [message]);
  }

  private async closeDeployment(client: SigningStargateClient, owner: string, dseq: string) {
    const message = {
      typeUrl: `/akash.deployment.v1beta3.MsgCloseDeployment`,
      value: MsgCloseDeployment.fromPartial({
        id: {
          owner: owner,
          dseq: dseq
        }
      })
    };

    await this.signAndBroadcast(owner, client, [message]);
  }

  private getModelSdl(vendor: string, model: string, ram: string, gpuInterface?: string) {
    let gpuSdl = gpuInterface ? sdlTemplateWithRamAndInterface : sdlTemplateWithRam;
    gpuSdl = gpuSdl.replace("<VENDOR>", vendor);
    gpuSdl = gpuSdl.replace("<MODEL>", model);
    gpuSdl = gpuSdl.replace("<RAM>", ram);

    if (gpuInterface) {
      gpuSdl = gpuSdl.replace("<INTERFACE>", gpuInterface.toLowerCase().startsWith("sxm") ? "sxm" : gpuInterface.toLowerCase());
    }

    return gpuSdl;
  }

  private async getCurrentHeight() {
    const response = await axios.get(`${apiNodeUrl}/blocks/latest`);

    const height = parseInt(response.data.block.header.height);

    if (isNaN(height)) throw new Error("Failed to get current height");

    return height;
  }
}
