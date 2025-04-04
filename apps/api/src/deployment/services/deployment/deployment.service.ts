import { BlockHttpService, DeploymentHttpService, LeaseHttpService } from "@akashnetwork/http-sdk";
import assert from "http-assert";
import { InternalServerError } from "http-errors";
import { singleton } from "tsyringe";

import { InjectWallet } from "@src/billing/providers/wallet.provider";
import { UserWalletOutput } from "@src/billing/repositories";
import { ManagedSignerService, RpcMessageService, Wallet } from "@src/billing/services";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import {
  CreateDeploymentRequest,
  CreateDeploymentResponse,
  GetDeploymentResponse,
  UpdateDeploymentRequest
} from "@src/deployment/http-schemas/deployment.schema";
import { ProviderService } from "@src/deployment/services/provider/provider.service";
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
    private readonly billingConfig: BillingConfigService,
    private readonly providerService: ProviderService
  ) {}

  public async findByOwnerAndDseq(
    owner: string,
    dseq: string,
    options?: { certificate?: { certPem: string; keyPem: string } }
  ): Promise<GetDeploymentResponse["data"]> {
    const deploymentResponse = await this.deploymentHttpService.findByOwnerAndDseq(owner, dseq);

    if ("code" in deploymentResponse) {
      assert(!deploymentResponse.message?.toLowerCase().includes("deployment not found"), 404, "Deployment not found");

      throw new InternalServerError(deploymentResponse.message);
    }

    const { leases } = await this.leaseHttpService.listByOwnerAndDseq(owner, dseq);

    const leasesWithStatus = await Promise.all(
      leases.map(async ({ lease }) => {
        if (!options?.certificate) {
          return {
            lease,
            status: null
          };
        }

        try {
          const leaseStatus = await this.providerService.getLeaseStatus(
            lease.lease_id.provider,
            lease.lease_id.dseq,
            lease.lease_id.gseq,
            lease.lease_id.oseq,
            options.certificate
          );
          return {
            lease,
            status: leaseStatus
          };
        } catch {
          return {
            lease,
            status: null
          };
        }
      })
    );

    return {
      deployment: deploymentResponse.deployment,
      leases: leasesWithStatus.map(({ lease, status }) => ({
        ...lease,
        status
      })),
      escrow_account: deploymentResponse.escrow_account
    };
  }

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

  public async update(wallet: UserWalletOutput, dseq: string, input: UpdateDeploymentRequest["data"]): Promise<GetDeploymentResponse["data"]> {
    const { sdl, certificate } = input;

    assert(this.sdlService.validateSdl(sdl), 400, "Invalid SDL");

    const deployment = await this.findByOwnerAndDseq(wallet.address, dseq);
    const manifestVersion = await this.sdlService.getManifestVersion(sdl, "beta3");
    const manifest = this.sdlService.getManifest(sdl, "beta3", true) as string;

    await this.ensureDeploymentIsUpToDate(wallet, dseq, manifestVersion, deployment);
    await this.sendManifestToProviders(dseq, manifest, certificate as { certPem: string; keyPem: string }, deployment.leases);

    return await this.findByOwnerAndDseq(wallet.address, dseq, { certificate: { certPem: certificate.certPem, keyPem: certificate.keyPem } });
  }

  private async ensureDeploymentIsUpToDate(
    wallet: UserWalletOutput,
    dseq: string,
    manifestVersion: Uint8Array,
    deployment: GetDeploymentResponse["data"]
  ): Promise<void> {
    if (Buffer.from(manifestVersion).toString("base64") !== deployment.deployment.version) {
      const message = this.rpcMessageService.getUpdateDeploymentMsg({
        owner: wallet.address,
        dseq,
        version: manifestVersion
      });

      await this.signerService.executeDecodedTxByUserId(wallet.userId, [message]);
    }
  }

  private async sendManifestToProviders(
    dseq: string,
    manifest: string,
    certificate: { certPem: string; keyPem: string },
    leases: GetDeploymentResponse["data"]["leases"]
  ): Promise<void> {
    assert(certificate.certPem && certificate.keyPem, 400, "Certificate must include both certPem and keyPem");

    const leaseProviders = leases.map(lease => lease.lease_id.provider).filter((v, i, s) => s.indexOf(v) === i);
    for (const provider of leaseProviders) {
      await this.providerService.sendManifest(provider, dseq, manifest, {
        certPem: certificate.certPem,
        keyPem: certificate.keyPem
      });
    }
  }
}
