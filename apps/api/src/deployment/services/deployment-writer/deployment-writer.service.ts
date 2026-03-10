import { manifestToSortedJSON } from "@akashnetwork/chain-sdk";
import { BlockHttpService } from "@akashnetwork/http-sdk";
import assert from "http-assert";
import { singleton } from "tsyringe";

import { UserWalletOutput } from "@src/billing/repositories";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { RpcMessageService } from "@src/billing/services/rpc-message-service/rpc-message.service";
import { WalletInitialized, WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
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
    private readonly rpcMessageService: RpcMessageService,
    private readonly sdlService: SdlService,
    private readonly billingConfig: BillingConfigService,
    private readonly providerService: ProviderService,
    private readonly deploymentReaderService: DeploymentReaderService,
    private readonly walletReaderService: WalletReaderService
  ) {}

  public async create(input: CreateDeploymentRequest["data"] & { userId: string }): Promise<CreateDeploymentResponse["data"]> {
    const wallet = await this.walletReaderService.getWalletByUserId(input.userId);
    const manifest = this.#parseManifest(input.sdl);

    const [dseq, manifestVersion] = await Promise.all([this.blockHttpService.getCurrentHeight(), this.sdlService.generateManifestVersion(manifest.groups)]);

    const message = this.rpcMessageService.getCreateDeploymentMsg({
      owner: wallet.address,
      dseq,
      groups: manifest.groupSpecs,
      denom: this.billingConfig.get("DEPLOYMENT_GRANT_DENOM"),
      amount: denomToUdenom(input.deposit),
      hash: manifestVersion
    });

    const result = await this.signerService.executeDerivedDecodedTxByUserId(wallet.userId, [message]);
    return {
      dseq: dseq.toString(),
      manifest: manifestToSortedJSON(manifest.groups),
      signTx: result
    };
  }

  public async closeByUserIdAndDseq(userId: string, dseq: string): Promise<void> {
    const wallet = await this.walletReaderService.getWalletByUserId(userId);
    return this.close(wallet, dseq);
  }

  public async close(wallet: WalletInitialized, dseq: string): Promise<void> {
    const deployment = await this.deploymentReaderService.findByWalletAndDseq(wallet, dseq);
    const message = this.rpcMessageService.getCloseDeploymentMsg(wallet.address, deployment.deployment.id.dseq);
    await this.signerService.executeDecodedTxByUserWallet(wallet, [message]);
  }

  public async deposit(options: { userId: string; dseq: string; amount: number }): Promise<GetDeploymentResponse["data"]> {
    const wallet = await this.walletReaderService.getWalletByUserId(options.userId);
    const deployment = await this.deploymentReaderService.findByWalletAndDseq(wallet, options.dseq);
    const deploymentGrantDenom = this.billingConfig.get("DEPLOYMENT_GRANT_DENOM");

    const message = this.rpcMessageService.getDepositDeploymentMsg({
      owner: wallet.address,
      dseq: deployment.deployment.id.dseq,
      amount: denomToUdenom(options.amount),
      denom: deploymentGrantDenom,
      signer: wallet.address
    });

    await this.signerService.executeDerivedDecodedTxByUserId(wallet.userId, [message]);

    return await this.deploymentReaderService.findByWalletAndDseq(wallet, options.dseq);
  }

  public async updateByUserIdAndDseq(userId: string, dseq: string, input: UpdateDeploymentRequest["data"]): Promise<GetDeploymentResponse["data"]> {
    const wallet = await this.walletReaderService.getWalletByUserId(userId);
    const manifest = this.#parseManifest(input.sdl);

    const [deployment, manifestVersion] = await Promise.all([
      this.deploymentReaderService.findByWalletAndDseq(wallet, dseq),
      this.sdlService.generateManifestVersion(manifest.groups)
    ]);

    await this.ensureDeploymentIsUpToDate(wallet, dseq, manifestVersion, deployment);
    const auth = { walletId: wallet.id };
    await this.sendManifestToProviders({ auth, dseq, manifest: manifestToSortedJSON(manifest.groups), leases: deployment.leases });

    return await this.deploymentReaderService.findByWalletAndDseq(wallet, dseq);
  }

  #parseManifest(sdl: string) {
    const manifestResult = this.sdlService.generateManifest(sdl);
    assert(manifestResult.ok, 400, `Invalid SDL: ${manifestResult.ok === false ? manifestResult.value.map(e => e.message).join(", ") : ""}`);
    return manifestResult.value;
  }

  private async ensureDeploymentIsUpToDate(
    wallet: UserWalletOutput,
    dseq: string,
    manifestVersion: Uint8Array,
    deployment: GetDeploymentResponse["data"]
  ): Promise<void> {
    if (Buffer.from(manifestVersion).toString("base64") !== deployment.deployment.hash) {
      const message = this.rpcMessageService.getUpdateDeploymentMsg({
        owner: wallet.address!,
        dseq,
        hash: manifestVersion
      });

      await this.signerService.executeDerivedDecodedTxByUserId(wallet.userId, [message]);
    }
  }

  private async sendManifestToProviders({
    leases,
    auth,
    ...options
  }: {
    dseq: string;
    manifest: string;
    leases: GetDeploymentResponse["data"]["leases"];
    auth: { walletId: number };
  }): Promise<void> {
    const leaseProviders = new Set(leases.map(lease => lease.id.provider));
    for (const provider of leaseProviders) {
      await this.providerService.sendManifest({
        provider,
        ...options,
        auth: await this.providerService.toProviderAuth({ walletId: auth.walletId, provider })
      });
    }
  }
}
