import { BlockHttpService } from "@akashnetwork/http-sdk";
import assert from "http-assert";
import { singleton } from "tsyringe";

import { Wallet } from "@src/billing/lib/wallet/wallet";
import { InjectWallet } from "@src/billing/providers/wallet.provider";
import { UserWalletOutput } from "@src/billing/repositories";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { RpcMessageService } from "@src/billing/services/rpc-message-service/rpc-message.service";
import {
  CreateDeploymentRequest,
  CreateDeploymentResponse,
  GetDeploymentResponse,
  UpdateDeploymentRequest
} from "@src/deployment/http-schemas/deployment.schema";
import { SdlService } from "@src/deployment/services/sdl/sdl.service";
import { ProviderService } from "@src/provider/services/provider/provider.service";
import { denomToUdenom } from "@src/utils/math";
import { DeploymentReaderService } from "../deployment-reader/deployment-reader.service";

@singleton()
export class DeploymentWriterService {
  constructor(
    private readonly blockHttpService: BlockHttpService,
    private readonly signerService: ManagedSignerService,
    @InjectWallet("MANAGED") private readonly masterWallet: Wallet,
    private readonly rpcMessageService: RpcMessageService,
    private readonly sdlService: SdlService,
    private readonly billingConfig: BillingConfigService,
    private readonly providerService: ProviderService,
    private readonly deploymentReaderService: DeploymentReaderService
  ) {}

  public async create(wallet: UserWalletOutput, input: CreateDeploymentRequest["data"]): Promise<CreateDeploymentResponse["data"]> {
    let sdl: string = input.sdl;
    const deploymentGrantDenom = this.billingConfig.get("DEPLOYMENT_GRANT_DENOM");

    assert(this.sdlService.validateSdl(sdl), 400, "Invalid SDL");

    if (deploymentGrantDenom !== "uakt") {
      sdl = sdl.replace(/uakt/g, deploymentGrantDenom);
    }

    const dseq = await this.blockHttpService.getCurrentHeight();
    const groups = this.sdlService.getDeploymentGroups(sdl, "beta3");
    const manifestVersion = await this.sdlService.getManifestVersion(sdl, "beta3");
    const manifest = this.sdlService.getManifest(sdl, "beta3", true) as string;

    const message = this.rpcMessageService.getCreateDeploymentMsg({
      owner: wallet.address!,
      dseq,
      groups,
      denom: deploymentGrantDenom,
      amount: denomToUdenom(input.deposit),
      manifestVersion,
      depositor: await this.masterWallet.getFirstAddress()
    });

    const result = await this.signerService.executeDecodedTxByUserId(wallet.userId, [message]);
    return {
      dseq: dseq.toString(),
      manifest,
      signTx: result
    };
  }

  public async close(wallet: UserWalletOutput, dseq: string): Promise<{ success: boolean }> {
    const deployment = await this.deploymentReaderService.findByOwnerAndDseq(wallet.address!, dseq);
    const message = this.rpcMessageService.getCloseDeploymentMsg(wallet.address!, deployment.deployment.deployment_id.dseq);
    await this.signerService.executeDecodedTxByUserWallet(wallet, [message]);

    return { success: true };
  }

  public async deposit(wallet: UserWalletOutput, dseq: string, amount: number): Promise<GetDeploymentResponse["data"]> {
    const deployment = await this.deploymentReaderService.findByOwnerAndDseq(wallet.address!, dseq);
    const deploymentGrantDenom = this.billingConfig.get("DEPLOYMENT_GRANT_DENOM");
    const depositor = await this.masterWallet.getFirstAddress();

    const message = this.rpcMessageService.getDepositDeploymentMsg({
      owner: wallet.address!,
      dseq: deployment.deployment.deployment_id.dseq,
      amount: denomToUdenom(amount),
      denom: deploymentGrantDenom,
      depositor
    });

    await this.signerService.executeDecodedTxByUserId(wallet.userId, [message]);

    return await this.deploymentReaderService.findByOwnerAndDseq(wallet.address!, dseq);
  }

  public async update(wallet: UserWalletOutput, dseq: string, input: UpdateDeploymentRequest["data"]): Promise<GetDeploymentResponse["data"]> {
    const { sdl } = input;

    assert(this.sdlService.validateSdl(sdl), 400, "Invalid SDL");

    const deployment = await this.deploymentReaderService.findByOwnerAndDseq(wallet.address!, dseq);
    const manifestVersion = await this.sdlService.getManifestVersion(sdl, "beta3");
    const manifest = this.sdlService.getManifest(sdl, "beta3", true) as string;

    await this.ensureDeploymentIsUpToDate(wallet, dseq, manifestVersion, deployment);
    await this.sendManifestToProviders(wallet.id, dseq, manifest, deployment.leases);

    return await this.deploymentReaderService.findByOwnerAndDseq(wallet.address!, dseq);
  }

  private async ensureDeploymentIsUpToDate(
    wallet: UserWalletOutput,
    dseq: string,
    manifestVersion: Uint8Array,
    deployment: GetDeploymentResponse["data"]
  ): Promise<void> {
    if (Buffer.from(manifestVersion).toString("base64") !== deployment.deployment.version) {
      const message = this.rpcMessageService.getUpdateDeploymentMsg({
        owner: wallet.address!,
        dseq,
        version: manifestVersion
      });

      await this.signerService.executeDecodedTxByUserId(wallet.userId, [message]);
    }
  }

  private async sendManifestToProviders(walletId: number, dseq: string, manifest: string, leases: GetDeploymentResponse["data"]["leases"]): Promise<void> {
    const leaseProviders = leases.map(lease => lease.lease_id.provider).filter((v, i, s) => s.indexOf(v) === i);
    for (const provider of leaseProviders) {
      await this.providerService.sendManifest({ provider, dseq, manifest, walletId });
    }
  }
}
