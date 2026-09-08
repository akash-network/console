import type { SDLInput, ValidationError } from "@akashnetwork/chain-sdk";
import { manifestToSortedJSON } from "@akashnetwork/chain-sdk";
import type { AnyAbility } from "@casl/ability";
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
import {
  CreateDeploymentRequest,
  CreateDeploymentResponse,
  DeploymentResponse,
  PatchDeploymentRequest,
  PatchDeploymentResponse,
  UpdateDeploymentRequest
} from "@src/deployment/http-schemas/deployment.schema";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import {
  DeleteUnbackedDeploymentSetting,
  unbackedDeploymentSettingKeyFor,
  unbackedDeploymentSettingRetryOptions
} from "@src/deployment/services/delete-unbacked-deployment-setting/delete-unbacked-deployment-setting.handler";
import { SdlService } from "@src/deployment/services/sdl/sdl.service";
import { SdlPatchService } from "@src/deployment/services/sdl-patch/sdl-patch.service";
import { MAX_ECHOED_REFERENCE_LENGTH, SdlReferenceService } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import { SdlSecretsService, unreferencedNameError } from "@src/deployment/services/sdl-secrets/sdl-secrets.service";
import { SdlSecretsDerivationService } from "@src/deployment/services/sdl-secrets-derivation/sdl-secrets-derivation.service";
import { SdlSecretsInheritanceService } from "@src/deployment/services/sdl-secrets-inheritance/sdl-secrets-inheritance.service";
import type { SdlSecrets } from "@src/deployment/services/sdl-secrets-unsealer/sdl-secrets-unsealer.service";
import type { StorableSdl, StoredSdlPosition, StoredSdlRefusal } from "@src/deployment/utils/sdl-for-storage/sdl-for-storage";
import { parseSdlForStorage, sdlForStorage } from "@src/deployment/utils/sdl-for-storage/sdl-for-storage";
import { ProviderService } from "@src/provider/services/provider/provider.service";
import { denomToUdenom } from "@src/utils/math";
import { DeploymentConfigService } from "../deployment-config/deployment-config.service";
import { DeploymentReaderService } from "../deployment-reader/deployment-reader.service";
import { StaleManagedDeploymentsCleanerService } from "../stale-managed-deployments-cleaner/stale-managed-deployments-cleaner.service";

const SECRET_REFERENCE_KIND = "secret";

/** Distinct from the sealed-secret failure so a client can tell which half of the stored state it cannot read, both being permanent. */
const STORED_SDL_UNREADABLE_ERROR_CODE = "stored_sdl_unreadable";

/** A deployment the console never recorded an SDL for has nothing to patch, and the SDL is deliberately not accepted from the request. */
const NOT_PATCHABLE_MESSAGE = "This deployment has no SDL recorded by the console, so there is nothing to patch";

/** What becomes of the values a submitted document carries in the clear. There is no longer a way to say "dropped": every writer can seal, so a value is never lost to be safe. */
type StoredSdlValues =
  /** Every one of them is sealed and referenced, because nothing in the request said which are secret. */
  | "every-value-sealed"
  /** Only a registry credential is, a seal having already said which of the rest are secret. */
  | "only-credentials-sealed";

/** Lowest precedence first: what the deployment carried in, then what the request supplied, then what the document gave up. */
function prunedOverlayOf(sets: { carried: SdlSecrets; supplied: SdlSecrets; derived: SdlSecrets }, referenced: ReadonlySet<string>): SdlSecrets {
  const overlaid: SdlSecrets = { ...sets.carried, ...sets.supplied, ...sets.derived };

  return Object.fromEntries(Object.entries(overlaid).filter(([name]) => referenced.has(name)));
}

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
    private readonly sdlSecretsDerivationService: SdlSecretsDerivationService,
    private readonly sdlPatchService: SdlPatchService,
    private readonly sdlReferenceService: SdlReferenceService,
    private readonly sdlSecretsInheritanceService: SdlSecretsInheritanceService
  ) {
    this.logger = createLogger({ context: DeploymentWriterService.name });
  }

  /** The dseq is minted once everything that can refuse the submitted document has run, because the token written below names it and a client sealing beforehand cannot; a refusal that needs the resolved document — a sealed registry password below the schema's minimum, say — can only come after it, and spends a dseq nothing is written under. */
  public async create(input: CreateDeploymentRequest["data"] & { userId: string }): Promise<CreateDeploymentResponse["data"]> {
    /** SDL for storage ONLY, and the values taken out of it. Never stands in for the submitted document anywhere a hash is taken. */
    const { sdl, storedDocument, derived } = this.#storedSdlOf(input.sdl, input.sealedSecrets ? "only-credentials-sealed" : "every-value-sealed");

    const wallet = await this.walletReaderService.getWalletByUserId(input.userId);
    const depositInDollars = this.deploymentConfig.get("DEPLOYMENT_DEFAULT_DEPOSIT");
    const inherited = await this.#inheritedSecretsOf(input);
    const supplied = await this.#receiveSecrets(input, inherited);
    const stored = this.#storedSecretsOf({ inherited, supplied, derived }, storedDocument);

    const dseq = Date.now().toString();
    const { manifestVersion, manifest } = await this.#resolveSdl(input.sdl, { secrets: { ...inherited, ...supplied }, isTrialing: !!wallet.isTrialing });
    const unresolvedManifest = await this.#unresolvedManifestOf(input.sdl);
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
      manifest: unresolvedManifest,
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
    sealedSecrets: string | null;
    runtimeLimitHours?: number;
  }): Promise<void> {
    const { owner, ...definition } = input;

    const singletonKey = unbackedDeploymentSettingKeyFor(input);

    await this.txService.transaction(async () => {
      const deploymentSettingId = await this.recordDefinition(definition);

      const compensationId = await this.jobQueueService.enqueue(new DeleteUnbackedDeploymentSetting({ deploymentSettingId, owner, dseq: input.dseq }), {
        singletonKey,
        startAfter: addMinutes(new Date(), this.deploymentConfig.get("UNBACKED_DEPLOYMENT_SETTING_GRACE_IN_MIN")).toISOString(),
        ...unbackedDeploymentSettingRetryOptions(this.deploymentConfig)
      });

      if (compensationId) return;

      if (!(await this.compensationIsStillWaiting(singletonKey))) {
        throw new Error(`Refusing to record deployment setting ${deploymentSettingId} without a compensation: the queue accepted no job`);
      }

      this.logger.info({ event: "UNBACKED_DEPLOYMENT_SETTING_COMPENSATION_ALREADY_WAITING", deploymentSettingId, owner, dseq: input.dseq });
    });
  }

  /** A retry inherits the compensation its failed predecessor left only while that job cannot run before the signer gives up: one that judges the row first finds no deployment and deletes it, and `cancelCreatedBy` cannot call off a job a worker holds. */
  private async compensationIsStillWaiting(singletonKey: string): Promise<boolean> {
    return await this.jobQueueService.hasWaitingSingleton({
      name: DeleteUnbackedDeploymentSetting[JOB_NAME],
      singletonKey,
      notDueBefore: new Date(Date.now() + this.billingConfig.get("TX_SIGNER_REQUEST_TIMEOUT_MS"))
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
    /** Stated rather than optional, so a definition write cannot leave the previous create's token beside an SDL that no longer references the names in it. */
    sealedSecrets: string | null;
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
  #storedSdlOf(submittedSdl: string, values: StoredSdlValues, dseq?: string): { sdl: string; storedDocument: SDLInput; derived: SdlSecrets } {
    const parsed = parseSdlForStorage(submittedSdl);

    if (parsed.document === null) {
      throw this.#rejectUnstorableSdl("unparseable", { dseq, length: submittedSdl.length, at: parsed.at });
    }

    const derived = this.#takeValuesOutOf(parsed.document, values);
    const { sdl, length } = sdlForStorage(parsed, SDL_MAX_LENGTH);

    if (sdl === null) {
      throw this.#rejectUnstorableSdl("too-large", { dseq, length });
    }

    return { sdl, storedDocument: parsed.document, derived };
  }

  /** Runs before the document is measured, so that what the size guard bounds is exactly what gets stored. */
  #takeValuesOutOf(document: SDLInput, values: StoredSdlValues): SdlSecrets {
    return this.sdlSecretsDerivationService.derive(document, { includeEnvValues: values === "every-value-sealed" });
  }

  /** The one set of values the deployment's token carries, overlaid as inherited, then supplied, then derived, refusing only a supplied name the console also derived because both were chosen for this request. */
  #storedSecretsOf(sets: { inherited: SdlSecrets; supplied: SdlSecrets; derived: SdlSecrets }, storedDocument: SDLInput): SdlSecrets {
    const collisions = Object.keys(sets.derived).filter(name => Object.hasOwn(sets.supplied, name));

    if (collisions.length > 0) {
      const echoed = collisions[0].slice(0, MAX_ECHOED_REFERENCE_LENGTH);
      this.logger.warn({ event: "SDL_SECRETS_DERIVED_NAME_COLLIDED", name: echoed, collisionCount: collisions.length });

      throw createError(400, `"${echoed}" is a name the console derives for this deployment and cannot also be supplied for it`);
    }

    const referenced = this.#referencedNamesOf(storedDocument);
    this.#assertCarriedSetIsStorable(sets, referenced);

    return prunedOverlayOf({ carried: sets.inherited, supplied: sets.supplied, derived: sets.derived }, referenced);
  }

  /** Bounds only what this deployment will actually keep from elsewhere, so neither a large source nor a stale inherited value a derived name displaces can refuse the redeploy. */
  #assertCarriedSetIsStorable(sets: { inherited: SdlSecrets; supplied: SdlSecrets; derived: SdlSecrets }, referenced: ReadonlySet<string>): void {
    const carried = prunedOverlayOf({ carried: sets.inherited, supplied: sets.supplied, derived: {} }, referenced);
    const kept = Object.fromEntries(Object.entries(carried).filter(([name]) => !Object.hasOwn(sets.derived, name)));

    this.sdlSecretsService.assertStorable(kept, "carried");
  }

  /** Refused before the dseq is minted, so a source that cannot be found or whose token will not open spends no dseq and leaves nothing recorded. */
  async #inheritedSecretsOf(input: { userId: string; inheritSecretsFrom?: string }): Promise<SdlSecrets> {
    if (!input.inheritSecretsFrom) return {};

    return await this.sdlSecretsInheritanceService.open({ userId: input.userId, dseq: input.inheritSecretsFrom });
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

  /**
   * An update resubmits the whole SDL, so what it stores replaces the definition wholesale — the token
   * included, rather than left to survive from the create the way it did before this could write one.
   * Sealing runs after everything that can still refuse the request, so a 404 on the deployment or a
   * reference with no value spends no key-service call.
   */
  public async updateByUserIdAndDseq(userId: string, dseq: string, input: UpdateDeploymentRequest["data"]): Promise<DeploymentResponse> {
    this.logger.warn({ event: "DEPRECATED_UPDATE_DEPLOYMENT_ENDPOINT_USED", userId, dseq });

    const wallet = await this.walletReaderService.getWalletByUserId(userId);
    const { sdl, derived } = this.#storedSdlOf(input.sdl, "every-value-sealed", dseq);

    const { manifestVersion, manifest } = await this.#resolveSdl(input.sdl, { isTrialing: !!wallet.isTrialing });
    const deployment = await this.deploymentReaderService.findByWalletAndDseq(wallet, dseq);
    const sealedSecrets = await this.sdlSecretsService.sealForStorage({ userId: wallet.userId, dseq, secrets: derived });

    await this.recordDefinition({ userId: wallet.userId, dseq, sdl, manifestVersion, sealedSecrets });

    await this.ensureDeploymentIsUpToDate(wallet, dseq, manifestVersion, deployment);
    const auth = { walletId: wallet.id };
    await this.sendManifestToProviders({ auth, dseq, manifest: manifestToSortedJSON(manifest.groups), leases: deployment.leases });

    return await this.deploymentReaderService.findByWalletAndDseq(wallet, dseq);
  }

  /**
   * Patches the SDL the console stored rather than one a client resubmits, refusing everything it can
   * before the single write so a refusal leaves the row untouched. The ability is passed in rather than
   * read from request state, because this service is a singleton.
   *
   * A patch is read-modify-write, so a caller naming no version is still guarded on the version this call
   * read: without that, two concurrent unguarded patches would each build on the same document and the
   * later one would silently discard the earlier. A row recording no version yet cannot be guarded on one.
   */
  public async patchByUserIdAndDseq(
    userId: string,
    dseq: string,
    input: PatchDeploymentRequest["data"],
    ability: AnyAbility
  ): Promise<PatchDeploymentResponse["data"]> {
    const [wallet, stored] = await Promise.all([this.walletReaderService.getWalletByUserId(userId), this.#findStoredDefinition({ userId, dseq }, ability)]);
    const parsed = this.#parseStored(stored.sdl, { userId, dseq });
    const document = parsed.document;

    const written = this.sdlPatchService.apply(document, input.services);
    const derived = this.sdlSecretsDerivationService.derive(document, { includeEnvValues: true, onlyAt: written });
    const patchedSdl = this.#serialize(parsed, { userId, dseq });

    const [supplied, held] = await Promise.all([
      input.sealedSecrets ? this.sdlSecretsService.receiveForMerge({ rawSdl: stored.sdl, sealedSecrets: input.sealedSecrets }) : {},
      stored.sealedSecrets ? this.sdlSecretsService.openStored({ userId, dseq, sealedSecrets: stored.sealedSecrets }) : {}
    ]);
    const merged = this.#mergeAndPrune({ held, supplied, derived }, document);

    const { manifestVersion, manifest } = await this.#resolveSdl(patchedSdl, { secrets: merged, isTrialing: !!wallet.isTrialing });
    const deployment = await this.deploymentReaderService.findByWalletAndDseq(wallet, dseq);

    const recordedVersion = Buffer.from(manifestVersion).toString("base64");
    const sealedSecrets = await this.sdlSecretsService.sealForStorage({ userId, dseq, secrets: merged });

    const recordedId = await this.deploymentSettingRepository.accessibleBy(ability, "update").replaceDefinitionIfVersionMatches({
      userId,
      dseq,
      sdl: patchedSdl,
      manifestVersion: recordedVersion,
      sealedSecrets,
      expectedManifestVersion: input.ifManifestVersion ?? stored.manifestVersion
    });

    if (!recordedId) {
      throw createError(409, "Deployment definition changed concurrently, please retry");
    }

    this.logger.info({
      event: "DEPLOYMENT_PATCH_APPLIED",
      userId,
      dseq,
      patchedServiceCount: Object.keys(input.services).length,
      secretCount: Object.keys(merged).length,
      guarded: input.ifManifestVersion !== undefined
    });

    await this.ensureDeploymentIsUpToDate(wallet, dseq, manifestVersion, deployment);
    await this.sendManifestToProviders({
      auth: { walletId: wallet.id },
      dseq,
      manifest: manifestToSortedJSON(manifest.groups),
      leases: deployment.leases
    });

    return { ...(await this.deploymentReaderService.findByWalletAndDseq(wallet, dseq)), manifestVersion: recordedVersion };
  }

  /** Read through the caller's own ability as well as their id, so a definition is unreachable by anyone the ability excludes even before the write re-checks it. */
  async #findStoredDefinition(
    key: { userId: string; dseq: string },
    ability: AnyAbility
  ): Promise<{ sdl: string; sealedSecrets: string | null; manifestVersion?: string }> {
    const setting = await this.deploymentSettingRepository.accessibleBy(ability, "read").findOneBy(key);

    if (!setting?.sdl) {
      throw createError(404, NOT_PATCHABLE_MESSAGE);
    }

    return { sdl: setting.sdl, sealedSecrets: setting.sealedSecrets, manifestVersion: setting.manifestVersion ?? undefined };
  }

  /** The caller did not supply this document, so an unparseable one is the console's fault and never a 400. */
  #parseStored(sdl: string, key: { userId: string; dseq: string }): StorableSdl {
    const parsed = parseSdlForStorage(sdl);

    if (parsed.document === null) {
      this.logger.error({ event: "DEPLOYMENT_STORED_SDL_UNPARSEABLE", ...key });

      throw createError(500, "The SDL recorded for this deployment cannot be read", { errorCode: STORED_SDL_UNREADABLE_ERROR_CODE });
    }

    return parsed;
  }

  /** Carries the parsed document's own `mayShareNodes` rather than assuming it, so the alias-safe size estimate runs only for a document that actually anchors something. */
  #serialize(parsed: StorableSdl, key: { userId: string; dseq: string }): string {
    const { sdl, length } = sdlForStorage(parsed, SDL_MAX_LENGTH);

    if (sdl === null) {
      this.logger.warn({ event: "DEPLOYMENT_PATCHED_SDL_TOO_LARGE", ...key, length, maxLength: SDL_MAX_LENGTH });

      throw createError(400, `The patched SDL is too large: it exceeds the maximum of ${SDL_MAX_LENGTH} characters once stored`);
    }

    return sdl;
  }

  /** What the deployment held, overlaid by what the request supplied and then by what the patched document gave up, pruned to the names the document still references. */
  #mergeAndPrune(sets: { held: SdlSecrets; supplied: SdlSecrets; derived: SdlSecrets }, document: SDLInput): SdlSecrets {
    const referenced = this.#referencedNamesOf(document);

    this.#assertEverySuppliedNameIsReferenced(sets.supplied, referenced);

    const merged = prunedOverlayOf({ carried: sets.held, supplied: sets.supplied, derived: sets.derived }, referenced);

    this.sdlSecretsService.assertStorable(merged, "stored");

    return merged;
  }

  #referencedNamesOf(document: SDLInput): ReadonlySet<string> {
    return new Set(this.sdlReferenceService.declarationsOf(document, SECRET_REFERENCE_KIND).map(declaration => declaration.name));
  }

  /** A misspelt name is refused rather than dropped, so a caller cannot receive a 200 believing a credential rotated when nothing changed. */
  #assertEverySuppliedNameIsReferenced(supplied: SdlSecrets, referenced: ReadonlySet<string>): void {
    const unreferenced = Object.keys(supplied).filter(name => !referenced.has(name));

    if (unreferenced.length > 0) {
      throw this.#rejectInvalidSdl(unreferenced.map(unreferencedNameError));
    }
  }

  /** Must reach only the response field: the hash, the group specs and the recorded definition all still come from the resolved build above. */
  async #unresolvedManifestOf(sdl: string): Promise<string> {
    const result = await this.sdlService.generateManifest(sdl);

    if (!result.ok) {
      throw this.#rejectInvalidSdl(result.value);
    }

    return manifestToSortedJSON(result.value.groups);
  }

  /** Only the manifest version is taken from the resolved SDL: the resolved manifest itself must not leave this call, and a bad reference answers 400 before any deployment is looked up. */
  async #resolveSdl(sdl: string, options: { secrets?: SdlSecrets; isTrialing?: boolean }) {
    const result = await this.sdlService.generateResolvedManifest({ sdl, ...options, secrets: options.secrets ?? {} });

    if (!result.ok) {
      throw this.#rejectInvalidSdl(result.value);
    }

    return result.value;
  }

  /** Reports through the same channel every other reference mistake uses, so a missing value reads identically whether the intake or substitution found it. */
  async #receiveSecrets(input: CreateDeploymentRequest["data"], inherited: SdlSecrets): Promise<SdlSecrets> {
    const parsed = this.sdlService.parse(input.sdl);

    if (!parsed.ok) {
      throw this.#rejectInvalidSdl(parsed.value);
    }

    const received = await this.sdlSecretsService.receive({ sdl: parsed.value, rawSdl: input.sdl, sealedSecrets: input.sealedSecrets, inherited });

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
