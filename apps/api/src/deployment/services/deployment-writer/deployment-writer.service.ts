import type { SDLInput, ValidationError } from "@akashnetwork/chain-sdk";
import { manifestToSortedJSON } from "@akashnetwork/chain-sdk";
import { addMinutes } from "date-fns";
import { HTTPException } from "hono/http-exception";
import createError from "http-errors";
import { inject, singleton } from "tsyringe";

import type { UserWalletOutput, WalletInitialized } from "@src/billing/repositories";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { RpcMessageService } from "@src/billing/services/rpc-message-service/rpc-message.service";
import { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import { type CreateLogger, JOB_NAME, JobQueueService, LOGGER_FACTORY, TxService } from "@src/core";
import { SDL_MAX_LENGTH } from "@src/deployment/config/sdl.config";
import { CreateDeploymentRequest, CreateDeploymentResponse, DeploymentResponse, UpdateDeploymentRequest } from "@src/deployment/http-schemas/deployment.schema";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import {
  DeleteUnbackedDeploymentSetting,
  unbackedDeploymentSettingKeyFor
} from "@src/deployment/services/delete-unbacked-deployment-setting/delete-unbacked-deployment-setting.handler";
import { SdlService } from "@src/deployment/services/sdl/sdl.service";
import { MAX_ECHOED_REFERENCE_LENGTH, type NamespacedSdlSecrets } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import type { ReceivedSdlSecrets } from "@src/deployment/services/sdl-secrets/sdl-secrets.service";
import { SdlSecretsService } from "@src/deployment/services/sdl-secrets/sdl-secrets.service";
import { SdlSecretsDerivationService } from "@src/deployment/services/sdl-secrets-derivation/sdl-secrets-derivation.service";
import type { SdlSecrets } from "@src/deployment/services/sdl-secrets-unsealer/sdl-secrets-unsealer.service";
import type { StoredSdlPosition, StoredSdlRefusal } from "@src/deployment/utils/sdl-for-storage/sdl-for-storage";
import { dropSdlValues, parseSdlForStorage, sdlForStorage } from "@src/deployment/utils/sdl-for-storage/sdl-for-storage";
import { ProviderService } from "@src/provider/services/provider/provider.service";
import { denomToUdenom } from "@src/utils/math";
import { DeploymentConfigService } from "../deployment-config/deployment-config.service";
import { DeploymentReaderService } from "../deployment-reader/deployment-reader.service";
import { StaleManagedDeploymentsCleanerService } from "../stale-managed-deployments-cleaner/stale-managed-deployments-cleaner.service";

/** What becomes of the values a submitted document carries in the clear, once the console has decided what it can seal. */
type StoredSdlValues =
  /** Every one of them is sealed and referenced, because nothing in the request said which are secret. */
  | "every-value-sealed"
  /** Only a registry credential is, a seal having already said which of the rest are secret. */
  | "only-credentials-sealed"
  /** None are, so an `env` value is dropped and the credentials block removed, for a caller with nowhere to put them. */
  | "every-value-dropped";

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
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly txService: TxService,
    private readonly jobQueueService: JobQueueService,
    private readonly sdlSecretsService: SdlSecretsService,
    private readonly sdlSecretsDerivationService: SdlSecretsDerivationService
  ) {
    this.logger = createLogger({ context: DeploymentWriterService.name });
  }

  /** The dseq is minted once everything that can refuse the submitted document has run, because the token written below names it and a client sealing beforehand cannot; a refusal that needs the resolved document — a sealed registry password below the schema's minimum, say — can only come after it, and spends a dseq nothing is written under. */
  public async create(input: CreateDeploymentRequest["data"] & { userId: string }): Promise<CreateDeploymentResponse["data"]> {
    /** SDL for storage ONLY, and the values taken out of it. Never stands in for the submitted document anywhere a hash is taken. */
    const { sdl, derived } = this.#storedSdlOf(input.sdl, input.sealedSecrets ? "only-credentials-sealed" : "every-value-sealed");

    const wallet = await this.walletReaderService.getWalletByUserId(input.userId);
    const depositInDollars = this.deploymentConfig.get("DEPLOYMENT_DEFAULT_DEPOSIT");
    const secrets = await this.#receiveSecrets(input);
    const stored = this.#storedSecretsOf(secrets.supplied, derived);

    const dseq = Date.now().toString();
    const { manifestVersion, manifest } = await this.#resolveSdl(input.sdl, { secrets: secrets.byService, isTrialing: !!wallet.isTrialing });
    const sealedSecrets = await this.sdlSecretsService.sealForStorage({ userId: wallet.userId, dseq, secrets: stored });

    if (wallet.isTrialing) {
      await this.reclaimTrialOrphanedDeployments(wallet);
    }

    await this.recordDefinitionWithCompensation({
      userId: wallet.userId,
      owner: wallet.address,
      dseq,
      sdl,
      manifestVersion,
      sealedSecrets,
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
    sealedSecrets?: string | null;
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
    sealedSecrets?: string | null;
    runtimeLimitHours?: number;
  }): Promise<string> {
    const { manifestVersion, ...rest } = input;

    try {
      return await this.deploymentSettingRepository.upsertDefinition({
        ...rest,
        manifestVersion: Buffer.from(manifestVersion).toString("base64")
      });
    } catch (error) {
      const { sdl, sealedSecrets, ...loggable } = rest;
      this.logger.error({ event: "DEPLOYMENT_DEFINITION_PERSISTENCE_FAILED", ...loggable, hasSealedSecrets: !!sealedSecrets, error });
      throw error;
    }
  }

  /** `dseq` is a log field only, so a create can run this before minting one and still say which request it refused. */
  #storedSdlOf(submittedSdl: string, values: StoredSdlValues, dseq?: string): { sdl: string; derived: SdlSecrets } {
    const parsed = parseSdlForStorage(submittedSdl);

    if (parsed.document === null) {
      throw this.#rejectUnstorableSdl("unparseable", { dseq, length: submittedSdl.length, at: parsed.at });
    }

    const derived = this.#takeValuesOutOf(parsed.document, values);
    const { sdl, length } = sdlForStorage(parsed, SDL_MAX_LENGTH);

    if (sdl === null) {
      throw this.#rejectUnstorableSdl("too-large", { dseq, length });
    }

    return { sdl, derived };
  }

  /** Runs before the document is measured, so that what the size guard bounds is exactly what gets stored. */
  #takeValuesOutOf(document: SDLInput, values: StoredSdlValues): SdlSecrets {
    if (values === "every-value-dropped") {
      dropSdlValues(document);

      return {};
    }

    return this.sdlSecretsDerivationService.derive(document, { includeEnvValues: values === "every-value-sealed" }).secrets;
  }

  /**
   * The one set of values the deployment's token carries: what the client sealed, plus what the console
   * took out of the document itself. A name in both is refused rather than merged, because the two would
   * be different values under one name and the stored SDL would then reference whichever won.
   */
  #storedSecretsOf(supplied: SdlSecrets, derived: SdlSecrets): SdlSecrets {
    const collisions = Object.keys(derived).filter(name => Object.hasOwn(supplied, name));

    if (collisions.length > 0) {
      const echoed = collisions[0].slice(0, MAX_ECHOED_REFERENCE_LENGTH);
      this.logger.warn({ event: "SDL_SECRETS_DERIVED_NAME_COLLIDED", name: echoed, collisionCount: collisions.length });

      throw createError(400, `"${echoed}" is a name the console derives for this deployment and cannot also be supplied for it`);
    }

    return { ...supplied, ...derived };
  }

  /** Carries none of the document and attaches no parse error as a cause, because a `js-yaml` message quotes the line it failed on and the error handler logs the whole chain. */
  #rejectUnstorableSdl(refusal: StoredSdlRefusal, details: { dseq?: string; length: number; at?: StoredSdlPosition }) {
    const { at, ...loggable } = details;

    if (refusal === "unparseable") {
      this.logger.warn({ event: "DEPLOYMENT_SDL_UNPARSEABLE", ...loggable, line: at?.line, column: at?.column });

      return new HTTPException(400, { message: at ? `SDL is not valid YAML: line ${at.line}, column ${at.column}` : "SDL is not valid YAML" });
    }

    this.logger.warn({ event: "DEPLOYMENT_SDL_TOO_LARGE", ...loggable, maxLength: SDL_MAX_LENGTH });

    return new HTTPException(400, { message: `SDL is too large: it exceeds the maximum of ${SDL_MAX_LENGTH} characters once stored` });
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
    this.logger.warn({ event: "DEPRECATED_DEPOSIT_DEPLOYMENT_ENDPOINT_USED", userId: options.userId, dseq: options.dseq });

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
    const { sdl } = this.#storedSdlOf(input.sdl, "every-value-dropped", dseq);

    const { manifestVersion, manifest } = await this.#resolveSdl(input.sdl, { isTrialing: !!wallet.isTrialing });
    const deployment = await this.deploymentReaderService.findByWalletAndDseq(wallet, dseq);

    await this.recordDefinition({ userId: wallet.userId, dseq, sdl, manifestVersion });

    await this.ensureDeploymentIsUpToDate(wallet, dseq, manifestVersion, deployment);
    const auth = { walletId: wallet.id };
    await this.sendManifestToProviders({ auth, dseq, manifest: manifestToSortedJSON(manifest.groups), leases: deployment.leases });

    return await this.deploymentReaderService.findByWalletAndDseq(wallet, dseq);
  }

  /** Only the manifest version is taken from the resolved SDL: the resolved manifest itself must not leave this call. Runs before any lookup so a bad reference always answers 400 rather than racing a 404. */
  async #resolveSdl(sdl: string, options: { secrets?: NamespacedSdlSecrets; isTrialing?: boolean }) {
    const result = await this.sdlService.generateResolvedManifest({ sdl, ...options, secrets: options.secrets ?? {} });

    if (!result.ok) {
      throw this.#rejectInvalidSdl(result.value);
    }

    return result.value;
  }

  /** Reports through the same channel every other reference mistake uses, so a missing value reads identically whether the intake or substitution found it. */
  async #receiveSecrets(input: CreateDeploymentRequest["data"]): Promise<ReceivedSdlSecrets> {
    const parsed = this.sdlService.parse(input.sdl);

    if (!parsed.ok) {
      throw this.#rejectInvalidSdl(parsed.value);
    }

    const received = await this.sdlSecretsService.receive({ sdl: parsed.value, rawSdl: input.sdl, sealedSecrets: input.sealedSecrets });

    if (!received.ok) {
      throw this.#rejectInvalidSdl(received.value);
    }

    return received.value;
  }

  #rejectInvalidSdl(errors: ValidationError[]) {
    return createError(400, `Invalid SDL: ${errors.map(error => error.message).join(", ")}`);
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
