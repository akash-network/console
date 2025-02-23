import { MsgCreateDeployment } from "@akashnetwork/akash-api/v1beta3";
import { SDL } from "@akashnetwork/akashjs/build/sdl";
import { BlockHttpService, DeploymentHttpService, LeaseHttpService } from "@akashnetwork/http-sdk";
import { Registry } from "@cosmjs/proto-signing";
import { BadRequest, InternalServerError, NotFound } from "http-errors";
import { singleton } from "tsyringe";

import { InjectTypeRegistry } from "@src/billing/providers/type-registry.provider";
import { InjectWallet } from "@src/billing/providers/wallet.provider";
import { UserWalletOutput } from "@src/billing/repositories";
import { ManagedSignerService, Wallet } from "@src/billing/services";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { CreateDeploymentRequest, CreateDeploymentResponse, GetDeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";

@singleton()
export class DeploymentService {
  constructor(
    @InjectTypeRegistry() private readonly registry: Registry,
    private readonly blockHttpService: BlockHttpService,
    private readonly deploymentHttpService: DeploymentHttpService,
    private readonly leaseHttpService: LeaseHttpService,
    private readonly signerService: ManagedSignerService,
    @InjectWallet("MANAGED") private readonly masterWallet: Wallet,
    private readonly billingConfigService: BillingConfigService,
  ) { }

  public async findByOwnerAndDseq(owner: string, dseq: string): Promise<GetDeploymentResponse['data']> {
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

  public async create(wallet: UserWalletOutput, input: CreateDeploymentRequest['data']): Promise<CreateDeploymentResponse['data']> {
    let sdl: SDL;
    try {
      sdl = SDL.fromString(input.sdl, 'beta3');
    } catch (error) {
      if (error.name === 'SdlValidationError') {
        throw new BadRequest(error.message);
      }

      throw new BadRequest("Invalid SDL");
    }

    const dseq = await this.blockHttpService.getCurrentHeight();
    const manifestVersion = await sdl.manifestVersion();

    const message = {
      typeUrl: `/akash.deployment.v1beta3.MsgCreateDeployment`,
      value: MsgCreateDeployment.fromPartial({
        id: {
          owner: wallet.address,
          dseq: dseq
        },
        groups: sdl.groups(),
        version: manifestVersion,
        deposit: {
          denom: this.billingConfigService.get("DEPLOYMENT_GRANT_DENOM"),
          amount: input.deposit.toString(),
        },
        depositor: await this.masterWallet.getFirstAddress()
      })
    };
    const encodedMessage = {
      typeUrl: message.typeUrl,
      value: Buffer.from(this.registry.encode(message)).toString("base64")
    };

    return await this.signerService.executeEncodedTxByUserId(wallet.userId, [encodedMessage]);
  }
}
