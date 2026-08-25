import { manifestToSortedJSON } from "@akashnetwork/chain-sdk";
import assert from "http-assert";
import { singleton } from "tsyringe";

import type { UserWalletOutput, WalletInitialized } from "@src/billing/repositories";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { RpcMessageService } from "@src/billing/services/rpc-message-service/rpc-message.service";
import { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import { LoggerService } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { SDL_MAX_LENGTH } from "@src/deployment/config/sdl.config";
import {
  CreateDeploymentRequest,
  CreateDeploymentResponse,
  GetDeploymentResponse,
  UpdateDeploymentRequest
} from "@src/deployment/http-schemas/deployment.schema";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { SdlService } from "@src/deployment/services/sdl/sdl.service";
import { stripSdlSecrets } from "@src/deployment/utils/sdl-secret-stripping/sdl-secret-stripping";
import { ProviderService } from "@src/provider/services/provider/provider.service";
import { denomToUdenom } from "@src/utils/math";
import { DeploymentConfigService } from "../deployment-config/deployment-config.service";
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
    private readonly logger: LoggerService,
    private readonly deploymentConfig: DeploymentConfigService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly deploymentSettingRepository: DeploymentSettingRepository
  ) {}

  public async create(input: CreateDeploymentRequest["data"] & { userId: string }): Promise<CreateDeploymentResponse["data"]> {
    const wallet = await this.walletReaderService.getWalletByUserId(input.userId);
    const manifest = this.#parseManifest(input.sdl, { isTrialing: !!wallet.isTrialing });
    const depositInDollars = this.resolveDepositInDollars(input.deposit);

    if (wallet.isTrialing) {
      await this.reclaimTrialOrphanedDeployments(wallet);
    }

    const dseq = Date.now();
    const sdl = this.strippedSdlWithinLimit(input.sdl, dseq.toString());
    const manifestVersion = await this.sdlService.generateManifestVersion(manifest.groups);

    await this.recordDefinition({
      userId: wallet.userId,
      dseq: dseq.toString(),
      sdl,
      manifestVersion,
      runtimeLimitHours: input.runtimeLimitHours
    });

    const message = this.rpcMessageService.getCreateDeploymentMsg({
      owner: wallet.address,
      dseq,
      groups: manifest.groupSpecs,
      denom: this.billingConfig.get("DEPLOYMENT_GRANT_DENOM"),
      amount: denomToUdenom(depositInDollars),
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
   * Records what the deployment is before anything is broadcast, never after, on both create and
   * update. The reverse order would let a successful broadcast produce a deployment with no remembered
   * definition, which becomes unrecoverable once a later phase stores sealed secrets in the same write.
   * A broadcast that then fails leaves a record for something that is not running: on create the retry
   * takes a fresh dseq, so the orphaned row survives until the draining sweep collects it; on update
   * the dseq is the one being updated, so the same request retried — idempotent on both the record and
   * the chain — puts the two back in step.
   *
   * A failure here surfaces as an error rather than best-effort, and nothing is broadcast and no
   * manifest is re-sent: the user retries and gets both the deployment and its record, instead of a
   * deployment the console cannot describe.
   *
   * An update records unconditionally, including when the manifest version already matches the chain.
   * A matching version means the manifest is unchanged, not that the submitted document is: comments,
   * formatting, and everything outside the manifest can still differ, and it is the SDL that is
   * recorded.
   *
   * The write is last-writer-wins, with no compare-and-swap: two concurrent updates of one dseq can
   * interleave so the row keeps one SDL while the chain runs the other, both succeeding. That is inert
   * while nothing reads these columns, and needs revisiting when sealed secrets share the write.
   *
   * The stored SDL deliberately does not hash to the stored manifest version, and no future reader
   * should expect it to. The version is taken over the manifest the generator produced, which rewrites
   * the denom and appends the allowed auditors to its own parse; the stored SDL is the one the user
   * submitted, stripped. They describe the same deployment, not the same bytes.
   */
  private async recordDefinition(input: { userId: string; dseq: string; sdl: string; manifestVersion: Uint8Array; runtimeLimitHours?: number }): Promise<void> {
    const { manifestVersion, ...rest } = input;

    try {
      await this.deploymentSettingRepository.upsertDefinition({
        ...rest,
        manifestVersion: Buffer.from(manifestVersion).toString("base64")
      });
    } catch (error) {
      const { sdl, ...loggable } = rest;
      this.logger.error({ event: "DEPLOYMENT_DEFINITION_PERSISTENCE_FAILED", ...loggable, error });
      throw error;
    }
  }

  /**
   * The submitted SDL with its secrets taken out, or a 400 when it is larger than the console will
   * store. Rejecting rather than deploying-without-a-record is what keeps a deployment and the record
   * of what it is from ever disagreeing: a deployment the console cannot describe is one nobody can
   * later reproduce, redeploy, or attach sealed secrets to.
   *
   * It runs before the definition is written and before anything is broadcast, so a rejected create
   * leaves no row behind and nothing on chain, and a rejected update leaves the deployment running
   * exactly what it ran before, still described by the record it already had.
   *
   * Neither the log nor the error says anything about the SDL beyond how long it is. The whole point of
   * stripping is that user content does not end up somewhere it was not meant to be, and an error body
   * travels further than a log does.
   */
  private strippedSdlWithinLimit(submittedSdl: string, dseq: string): string {
    const { sdl, length } = stripSdlSecrets(submittedSdl, SDL_MAX_LENGTH);

    if (sdl === null) {
      this.logger.warn({ event: "DEPLOYMENT_SDL_TOO_LARGE", dseq, length, maxLength: SDL_MAX_LENGTH });
    }

    assert(sdl !== null, 400, `SDL is too large: it exceeds the maximum of ${SDL_MAX_LENGTH} characters once stored`);

    return sdl;
  }

  /**
   * Behind the managed-funding flag the platform bootstraps every deployment with a fixed, on-chain-valid deposit and
   * ignores any caller-supplied amount. With the flag off the legacy contract holds: the caller must supply the deposit.
   */
  private resolveDepositInDollars(requestedDeposit?: number): number {
    if (this.isManagedDepositEnabled()) {
      return this.deploymentConfig.get("DEPLOYMENT_DEFAULT_DEPOSIT");
    }

    assert(requestedDeposit != null, 400, "deposit is required");
    return requestedDeposit;
  }

  private isManagedDepositEnabled(): boolean {
    return this.featureFlagsService.isEnabled(FeatureFlags.AUTO_RELOAD_FIXED_THRESHOLD);
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
    if (this.isManagedDepositEnabled()) {
      this.logger.warn({ event: "DEPRECATED_DEPOSIT_DEPLOYMENT_ENDPOINT_USED", userId: options.userId, dseq: options.dseq });
    }

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
    const sdl = this.strippedSdlWithinLimit(input.sdl, dseq);

    const [deployment, manifestVersion] = await Promise.all([
      this.deploymentReaderService.findByWalletAndDseq(wallet, dseq),
      this.sdlService.generateManifestVersion(manifest.groups)
    ]);

    await this.recordDefinition({ userId: wallet.userId, dseq, sdl, manifestVersion });

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
