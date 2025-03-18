import { BlockHttpService, DeploymentHttpService, LeaseHttpService } from "@akashnetwork/http-sdk";
import { BadRequest, InternalServerError, NotFound } from "http-errors";
import { singleton } from "tsyringe";

import { InjectWallet } from "@src/billing/providers/wallet.provider";
import { UserWalletOutput } from "@src/billing/repositories";
import { ManagedSignerService, RpcMessageService, Wallet } from "@src/billing/services";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { CreateDeploymentRequest, CreateDeploymentResponse, GetDeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import { SdlService } from "@src/deployment/services/sdl/sdl.service";
import { denomToUdenom } from "@src/utils/math";

@singleton()
export class DeploymentService {
  constructor(
    private readonly blockHttpService: BlockHttpService,
    private readonly deploymentHttpService: DeploymentHttpService,
    private readonly leaseHttpService: LeaseHttpService,
    private readonly signerService: ManagedSignerService,
    @InjectWallet("MANAGED") private readonly masterWallet: Wallet,
    private readonly rpcMessageService: RpcMessageService,
    private readonly sdlService: SdlService,
    private readonly billingConfig: BillingConfigService
  ) {}

  public async findByOwnerAndDseq(owner: string, dseq: string): Promise<GetDeploymentResponse["data"]> {
    const deploymentResponse = await this.deploymentHttpService.findByOwnerAndDseq(owner, dseq);

    if ("code" in deploymentResponse) {
      if (deploymentResponse.message?.toLowerCase().includes("deployment not found")) {
        throw new NotFound("Deployment not found");
      }

      throw new InternalServerError(deploymentResponse.message);
    }

    const { leases } = await this.leaseHttpService.listByOwnerAndDseq(owner, dseq);

    return {
      deployment: deploymentResponse.deployment,
      leases: leases.map(({ lease }) => lease),
      escrow_account: deploymentResponse.escrow_account
    };
  }

  public async create(wallet: UserWalletOutput, input: CreateDeploymentRequest["data"]): Promise<CreateDeploymentResponse["data"]> {
    let sdl: string = input.sdl;
    const deploymentGrantDenom = this.billingConfig.get("DEPLOYMENT_GRANT_DENOM");

    if (!this.sdlService.validateSdl(sdl)) {
      throw new BadRequest("Invalid SDL");
    }

    if (deploymentGrantDenom !== "uakt") {
      sdl = sdl.replace(/uakt/g, deploymentGrantDenom);
    }

    const dseq = await this.blockHttpService.getCurrentHeight();
    const groups = this.sdlService.getDeploymentGroups(sdl, "beta3");
    const manifestVersion = await this.sdlService.getManifestVersion(sdl, "beta3");
    const manifest = this.sdlService.getManifest(sdl, "beta3", true) as string;

    const message = this.rpcMessageService.getCreateDeploymentMsg({
      owner: wallet.address,
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
    const deployment = await this.findByOwnerAndDseq(wallet.address, dseq);
    const message = this.rpcMessageService.getCloseDeploymentMsg(wallet.address, deployment.deployment.deployment_id.dseq);
    await this.signerService.executeDecodedTxByUserId(wallet.userId, [message]);

    return { success: true };
  }

  public async deposit(wallet: UserWalletOutput, dseq: string, amount: number): Promise<GetDeploymentResponse["data"]> {
    const deployment = await this.findByOwnerAndDseq(wallet.address, dseq);
    const deploymentGrantDenom = this.billingConfig.get("DEPLOYMENT_GRANT_DENOM");
    const depositor = await this.masterWallet.getFirstAddress();

    const message = this.rpcMessageService.getDepositDeploymentMsg({
      owner: wallet.address,
      dseq: deployment.deployment.deployment_id.dseq,
      amount: denomToUdenom(amount),
      denom: deploymentGrantDenom,
      depositor
    });

    await this.signerService.executeDecodedTxByUserId(wallet.userId, [message]);

    return await this.findByOwnerAndDseq(wallet.address, dseq);
  }
}
