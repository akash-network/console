import { manifestToSortedJSON } from "@akashnetwork/chain-sdk";
import assert from "http-assert";
import { singleton } from "tsyringe";

import { UserWalletOutput, WalletInitialized } from "@src/billing/repositories";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { RpcMessageService } from "@src/billing/services/rpc-message-service/rpc-message.service";
import { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import { LoggerService } from "@src/core";
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
import { StaleManagedDeploymentsCleanerService } from "../stale-managed-deployments-cleaner/stale-managed-deployments-cleaner.service";

@singleton()
export class DeploymentWriterService {
  constructor(
    private readonly signerService: ManagedSignerService,
    private readonly rpcMessageService: RpcMessageService,
    private readonly sdlService: SdlService,
    private readonly billingConfig: BillingConfigService,
    private readonly providerService: ProviderService,
    private readonly deploymentReaderService: DeploymentReaderService,
    private readonly walletReaderService: WalletReaderService,
    private readonly staleDeploymentsCleaner: StaleManagedDeploymentsCleanerService,
    private readonly logger: LoggerService
  ) {}

  public async create(input: CreateDeploymentRequest["data"] & { userId: string }): Promise<CreateDeploymentResponse["data"]> {
    const wallet = await this.walletReaderService.getWalletByUserId(input.userId);
    const manifest = this.#parseManifest(input.sdl, { isTrialing: !!wallet.isTrialing });

    if (wallet.isTrialing) {
      await this.reclaimTrialOrphanedDeployments(wallet);
    }

    const dseq = Date.now();
    const manifestVersion = await this.sdlService.generateManifestVersion(manifest.groups);

    const message = this.rpcMessageService.getCreateDeploymentMsg({
      owner: wallet.address,
      dseq,
      groups: manifest.groupSpecs,
      denom: this.billingConfig.get("DEPLOYMENT_GRANT_DENOM"),
      amount: denomToUdenom(input.deposit),
      hash: manifestVersion,
      reclamation: manifest.reclamation
    });

    const result = await this.signerService.executeDerivedDecodedTxByUserId(wallet.userId, [message]);
    return {
      dseq: dseq.toString(),
      manifest: manifestToSortedJSON(manifest.groups),
      signTx: result
    };
  }

  /**
   * Reclaims escrow from a trial wallet's orphaned (open, lease-less) deployments before a new create, so a stranded
   * trial user whose earlier close failed can deploy again without waiting for the periodic cleanup job. It runs
   * before the create tx so the freed deployment allowance is available when the create's balance check runs.
   * Best-effort: a cleanup failure never blocks the create, which then proceeds and may 402 exactly as it would today.
   * Age 0 also closes an actively-quoting lease-less deployment of the same trial user, acceptable since a trial
   * balance cannot fund two deployments at once.
   */
  private async reclaimTrialOrphanedDeployments(wallet: WalletInitialized): Promise<void> {
    try {
      await this.staleDeploymentsCleaner.cleanUpForWallet(wallet, 0);
    } catch (error) {
      this.logger.warn({ event: "TRIAL_ORPHAN_CLEANUP_FAILED", address: wallet.address, error });
    }
  }

  public async closeByUserIdAndDseq(userId: string, dseq: string): Promise<void> {
    const wallet = await this.walletReaderService.getWalletByUserId(userId);
    return this.close(wallet, dseq);
  }

  /**
   * Idempotent close: an already-`closed` deployment is a no-op. The state read is a check→broadcast window, so a
   * concurrent close (a user cancel racing the cleanup cron, or two overlapping cleanup runs) can settle it between
   * the read and the broadcast; the losing tx then fails on an already-closed deployment. Re-read once on failure and
   * treat a now-closed deployment as success, otherwise surface the original error.
   */
  public async close(wallet: WalletInitialized, dseq: string): Promise<void> {
    const deployment = await this.deploymentReaderService.findByWalletAndDseq(wallet, dseq);
    if (deployment.deployment.state === "closed") return;
    const message = this.rpcMessageService.getCloseDeploymentMsg(wallet.address, deployment.deployment.id.dseq);
    try {
      await this.signerService.executeDecodedTxByUserWallet(wallet, [message]);
    } catch (error) {
      const latest = await this.deploymentReaderService.findByWalletAndDseq(wallet, dseq).catch(() => null);
      if (latest?.deployment.state === "closed") return;
      throw error;
    }
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
    const manifest = this.#parseManifest(input.sdl, { isTrialing: !!wallet.isTrialing });

    const [deployment, manifestVersion] = await Promise.all([
      this.deploymentReaderService.findByWalletAndDseq(wallet, dseq),
      this.sdlService.generateManifestVersion(manifest.groups)
    ]);

    await this.ensureDeploymentIsUpToDate(wallet, dseq, manifestVersion, deployment);
    const auth = { walletId: wallet.id };
    await this.sendManifestToProviders({ auth, dseq, manifest: manifestToSortedJSON(manifest.groups), leases: deployment.leases });

    return await this.deploymentReaderService.findByWalletAndDseq(wallet, dseq);
  }

  #parseManifest(sdl: string, options: { isTrialing?: boolean } = {}) {
    const manifestResult = this.sdlService.generateManifest(sdl, options);
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
