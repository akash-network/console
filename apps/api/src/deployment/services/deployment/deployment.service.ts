import { BlockHttpService, DeploymentHttpService, LeaseHttpService } from "@akashnetwork/http-sdk";
import { BadRequest, InternalServerError, NotFound } from "http-errors";
import { singleton } from "tsyringe";

import { InjectWallet } from "@src/billing/providers/wallet.provider";
import { UserWalletOutput } from "@src/billing/repositories";
import { ManagedSignerService, RpcMessageService, Wallet } from "@src/billing/services";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { CreateDeploymentRequest, CreateDeploymentResponse, GetDeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import { SdlService } from "@src/deployment/services/sdl/sdl.service";

@singleton()
export class DeploymentService {
  constructor(
    private readonly blockHttpService: BlockHttpService,
    private readonly deploymentHttpService: DeploymentHttpService,
    private readonly leaseHttpService: LeaseHttpService,
    private readonly signerService: ManagedSignerService,
    @InjectWallet("MANAGED") private readonly masterWallet: Wallet,
    private readonly billingConfigService: BillingConfigService,
    private readonly rpcMessageService: RpcMessageService,
    private readonly sdlService: SdlService
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
    if (!this.sdlService.validateSdl(input.sdl)) {
      throw new BadRequest("Invalid SDL");
    }

    const dseq = await this.blockHttpService.getCurrentHeight();
    const groups = this.sdlService.getDeploymentGroups(input.sdl, "beta3", "sandbox");
    const manifestVersion = await this.sdlService.getManifestVersion(input.sdl, "beta3", "sandbox");
    const manifest = this.sdlService.getManifest(input.sdl, "beta3", "sandbox", true) as string;

    const message = this.rpcMessageService.getCreateDeploymentMsg({
      owner: wallet.address,
      dseq,
      groups,
      denom: this.billingConfigService.get("DEPLOYMENT_GRANT_DENOM"),
      amount: input.deposit,
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
}
