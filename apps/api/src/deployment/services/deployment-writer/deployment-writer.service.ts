import { manifestToSortedJSON } from "@akashnetwork/chain-sdk";
import { addMinutes } from "date-fns";
import { HTTPException } from "hono/http-exception";
import assert from "http-assert";
import createError from "http-errors";
import { inject, singleton } from "tsyringe";

import type { UserWalletOutput, WalletInitialized } from "@src/billing/repositories";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { RpcMessageService } from "@src/billing/services/rpc-message-service/rpc-message.service";
import { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import { type CreateLogger, JOB_NAME, JobQueueService, LOGGER_FACTORY, TxService } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { SDL_MAX_LENGTH } from "@src/deployment/config/sdl.config";
import { CreateDeploymentRequest, CreateDeploymentResponse, DeploymentResponse, UpdateDeploymentRequest } from "@src/deployment/http-schemas/deployment.schema";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import {
  DeleteUnbackedDeploymentSetting,
  unbackedDeploymentSettingKeyFor
} from "@src/deployment/services/delete-unbacked-deployment-setting/delete-unbacked-deployment-setting.handler";
import type { ResolvedSdl } from "@src/deployment/services/resolved-sdl/resolved-sdl.service";
import { ResolvedSdlService } from "@src/deployment/services/resolved-sdl/resolved-sdl.service";
import { SdlService } from "@src/deployment/services/sdl/sdl.service";
import { stripSdlSecrets } from "@src/deployment/utils/sdl-secret-stripping/sdl-secret-stripping";
import { ProviderService } from "@src/provider/services/provider/provider.service";
import { denomToUdenom } from "@src/utils/math";
import { DeploymentConfigService } from "../deployment-config/deployment-config.service";
import { DeploymentReaderService } from "../deployment-reader/deployment-reader.service";
import { StaleManagedDeploymentsCleanerService } from "../stale-managed-deployments-cleaner/stale-managed-deployments-cleaner.service";

@singleton()
export class DeploymentWriterService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly signerService: ManagedSignerService,
    private readonly rpcMessageService: RpcMessageService,
    private readonly sdlService: SdlService,
    private readonly billingConfig: BillingConfigService,
    private readonly providerService: ProviderService,
    private readonly deploymentReaderService: DeploymentReaderService,
    private readonly walletReaderService: WalletReaderService,
    private readonly staleDeploymentsCleaner: StaleManagedDeploymentsCleanerService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger,
    private readonly deploymentConfig: DeploymentConfigService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly txService: TxService,
    private readonly jobQueueService: JobQueueService,
    private readonly resolvedSdlService: ResolvedSdlService
  ) {
    this.logger = createLogger({ context: DeploymentWriterService.name });
  }

  public async create(input: CreateDeploymentRequest["data"] & { userId: string }): Promise<CreateDeploymentResponse["data"]> {
    const dseq = Date.now();
    /** SDL for storage ONLY, stripped of secrets */
    const sdl = this.#strippedSdlWithinLimit(input.sdl, dseq.toString());

    const wallet = await this.walletReaderService.getWalletByUserId(input.userId);
    const manifest = this.#parseManifest(input.sdl, { isTrialing: !!wallet.isTrialing });
    const { manifestVersion } = await this.#resolveSdl(input.sdl, { isTrialing: !!wallet.isTrialing });
    const depositInDollars = this.resolveDepositInDollars(input.deposit);

    if (wallet.isTrialing) {
      await this.reclaimTrialOrphanedDeployments(wallet);
    }

    await this.recordDefinitionWithCompensation({
      userId: wallet.userId,
      owner: wallet.address,
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

    await this.retireCompensation({ userId: wallet.userId, dseq: dseq.toString() });

    return {
      dseq: dseq.toString(),
      manifest: manifestToSortedJSON(manifest.groups),
      signTx: result
    };
  }

  /** The record and its compensation must land in one transaction: a record written without one is unreachable by anything in the codebase. */
  private async recordDefinitionWithCompensation(input: {
    userId: string;
    owner: string;
    dseq: string;
    sdl: string;
    manifestVersion: Uint8Array;
    runtimeLimitHours?: number;
  }): Promise<void> {
    const { owner, ...definition } = input;

    await this.txService.transaction(async () => {
      const deploymentSettingId = await this.recordDefinition(definition);

      const compensationId = await this.jobQueueService.enqueue(new DeleteUnbackedDeploymentSetting({ deploymentSettingId, owner, dseq: input.dseq }), {
        singletonKey: unbackedDeploymentSettingKeyFor(input),
        startAfter: addMinutes(new Date(), this.deploymentConfig.get("UNBACKED_DEPLOYMENT_SETTING_GRACE_IN_MIN")).toISOString(),
        retryLimit: this.deploymentConfig.get("UNBACKED_DEPLOYMENT_SETTING_RETRY_LIMIT"),
        retryBackoff: true,
        retryDelay: this.deploymentConfig.get("UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_IN_SEC"),
        retryDelayMax: this.deploymentConfig.get("UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_MAX_IN_MIN") * 60
      });

      if (!compensationId) {
        throw new Error(`Refusing to record deployment setting ${deploymentSettingId} without a compensation: the queue accepted no job`);
      }
    });
  }

  /** A failure must stay logged rather than raised: the create already succeeded, and an uncancelled compensation still asks the chain before deleting. */
  private async retireCompensation(key: { userId: string; dseq: string }): Promise<void> {
    try {
      await this.jobQueueService.cancelCreatedBy({
        name: DeleteUnbackedDeploymentSetting[JOB_NAME],
        singletonKey: unbackedDeploymentSettingKeyFor(key)
      });
    } catch (error) {
      this.logger.warn({ event: "UNBACKED_DEPLOYMENT_SETTING_COMPENSATION_CANCEL_FAILED", ...key, error });
    }
  }

  private async recordDefinition(input: {
    userId: string;
    dseq: string;
    sdl: string;
    manifestVersion: Uint8Array;
    runtimeLimitHours?: number;
  }): Promise<string> {
    const { manifestVersion, ...rest } = input;

    try {
      return await this.deploymentSettingRepository.upsertDefinition({
        ...rest,
        manifestVersion: Buffer.from(manifestVersion).toString("base64")
      });
    } catch (error) {
      const { sdl, ...loggable } = rest;
      this.logger.error({ event: "DEPLOYMENT_DEFINITION_PERSISTENCE_FAILED", ...loggable, error });
      throw error;
    }
  }

  #strippedSdlWithinLimit(submittedSdl: string, dseq: string): string {
    const { sdl, length, error } = stripSdlSecrets(submittedSdl, SDL_MAX_LENGTH);

    if (sdl === null) {
      this.logger.warn({ event: "DEPLOYMENT_SDL_TOO_LARGE", dseq, length, maxLength: SDL_MAX_LENGTH });
      throw new HTTPException(400, {
        cause: error,
        message: `SDL is too large: it exceeds the maximum of ${SDL_MAX_LENGTH} characters once stored`
      });
    }

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
   * balance cannot fund two deployments at once — but only because every way this request can still be refused has
   * already been tried. Nothing that can reject the caller may be added below this line.
   */
  private async reclaimTrialOrphanedDeployments(wallet: WalletInitialized): Promise<void> {
    try {
      await this.staleDeploymentsCleaner.cleanUpForWallet(wallet, 0);
    } catch (error) {
      this.logger.warn({ event: "TRIAL_ORPHAN_CLEANUP_FAILED", address: wallet.address, error });
    }
  }

  public async closeByUserIdAndDseq(userId: string, dseq: string): Promise<boolean> {
    const wallet = await this.walletReaderService.getWalletByUserId(userId);
    return this.close(wallet, dseq);
  }

  /**
   * Idempotent close: an already-`closed` deployment is a no-op. The state read is a check→broadcast window, so a
   * concurrent close (a user cancel racing the cleanup cron, or two overlapping cleanup runs) can settle it between
   * the read and the broadcast; the losing tx then fails on an already-closed deployment. Re-read once on failure and
   * treat a now-closed deployment as success, otherwise surface the original error. Returns false when the
   * deployment was already closed, so a caller can tell a close it performed from one that had already happened.
   */
  public async close(wallet: WalletInitialized, dseq: string): Promise<boolean> {
    const deployment = await this.deploymentReaderService.findByWalletAndDseq(wallet, dseq);
    if (deployment.deployment.state === "closed") return false;
    const message = this.rpcMessageService.getCloseDeploymentMsg(wallet.address, deployment.deployment.id.dseq);
    try {
      await this.signerService.executeDecodedTxByUserWallet(wallet, [message]);
    } catch (error) {
      const latest = await this.deploymentReaderService.findByWalletAndDseq(wallet, dseq).catch(() => null);
      if (latest?.deployment.state === "closed") return false;
      throw error;
    }
    return true;
  }

  public async deposit(options: { userId: string; dseq: string; amount: number }): Promise<DeploymentResponse> {
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

  public async updateByUserIdAndDseq(userId: string, dseq: string, input: UpdateDeploymentRequest["data"]): Promise<DeploymentResponse> {
    const wallet = await this.walletReaderService.getWalletByUserId(userId);
    const manifest = this.#parseManifest(input.sdl, { isTrialing: !!wallet.isTrialing });
    const sdl = this.#strippedSdlWithinLimit(input.sdl, dseq);

    const [deployment, { manifestVersion }] = await Promise.all([
      this.deploymentReaderService.findByWalletAndDseq(wallet, dseq),
      this.#resolveSdl(input.sdl, { isTrialing: !!wallet.isTrialing })
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

  /** Only the manifest version is taken from the resolved SDL: the resolved manifest itself must not leave this call. */
  async #resolveSdl(sdl: string, options: { isTrialing?: boolean }): Promise<Pick<ResolvedSdl, "manifestVersion">> {
    const result = await this.resolvedSdlService.resolve({ sdl, secrets: {}, ...options });

    if (!result.ok) {
      throw createError(400, `Invalid SDL: ${result.value.map(error => error.message).join(", ")}`);
    }

    return { manifestVersion: result.value.manifestVersion };
  }

  private async ensureDeploymentIsUpToDate(wallet: UserWalletOutput, dseq: string, manifestVersion: Uint8Array, deployment: DeploymentResponse): Promise<void> {
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
    leases: DeploymentResponse["leases"];
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
