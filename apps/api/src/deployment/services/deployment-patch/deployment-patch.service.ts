import type { SDLInput, ValidationError } from "@akashnetwork/chain-sdk";
import { manifestToSortedJSON } from "@akashnetwork/chain-sdk";
import createError from "http-errors";
import { inject, singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import type { WalletInitialized } from "@src/billing/repositories";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { RpcMessageService } from "@src/billing/services/rpc-message-service/rpc-message.service";
import { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { SDL_MAX_LENGTH } from "@src/deployment/config/sdl.config";
import type { DeploymentResponse, PatchDeploymentRequest, PatchDeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { DeploymentReaderService } from "@src/deployment/services/deployment-reader/deployment-reader.service";
import { SdlService } from "@src/deployment/services/sdl/sdl.service";
import { SdlPatchService } from "@src/deployment/services/sdl-patch/sdl-patch.service";
import { SdlReferenceService } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import { SdlSecretsService, unreferencedNameError } from "@src/deployment/services/sdl-secrets/sdl-secrets.service";
import { SdlSecretsDerivationService } from "@src/deployment/services/sdl-secrets-derivation/sdl-secrets-derivation.service";
import type { SdlSecrets } from "@src/deployment/services/sdl-secrets-unsealer/sdl-secrets-unsealer.service";
import type { StorableSdl } from "@src/deployment/utils/sdl-for-storage/sdl-for-storage";
import { parseSdlForStorage, sdlForStorage } from "@src/deployment/utils/sdl-for-storage/sdl-for-storage";
import { ProviderService } from "@src/provider/services/provider/provider.service";

const SECRET_REFERENCE_KIND = "secret";

/** A deployment the console never recorded an SDL for has nothing to patch, and the SDL is deliberately not accepted from the request. */
const NOT_PATCHABLE_MESSAGE = "This deployment has no SDL recorded by the console, so there is nothing to patch";

/**
 * Patches the SDL the console stored for a deployment, rather than the one a client resubmits.
 *
 * Everything that can refuse the request runs before the single write, so a refusal leaves the stored
 * SDL and the stored token exactly as they were. The cheap structural refusals run before either token
 * is opened, so a malformed patch costs no key-service call at all.
 */
@singleton()
export class DeploymentPatchService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly walletReaderService: WalletReaderService,
    private readonly deploymentReaderService: DeploymentReaderService,
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly authService: AuthService,
    private readonly sdlPatchService: SdlPatchService,
    private readonly sdlService: SdlService,
    private readonly sdlReferenceService: SdlReferenceService,
    private readonly sdlSecretsService: SdlSecretsService,
    private readonly sdlSecretsDerivationService: SdlSecretsDerivationService,
    private readonly signerService: ManagedSignerService,
    private readonly rpcMessageService: RpcMessageService,
    private readonly providerService: ProviderService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: DeploymentPatchService.name });
  }

  public async patchByUserIdAndDseq(userId: string, dseq: string, input: PatchDeploymentRequest["data"]): Promise<PatchDeploymentResponse["data"]> {
    const wallet = await this.walletReaderService.getWalletByUserId(userId);
    const stored = await this.#findStoredDefinition({ userId, dseq });
    const parsed = this.#parseStored(stored.sdl, { userId, dseq });
    const document = parsed.document;

    const written = this.sdlPatchService.apply(document, input.services);
    const derived = this.sdlSecretsDerivationService.derive(document, { includeEnvValues: true, onlyAt: written });
    const patchedSdl = this.#serialize(parsed, { userId, dseq });

    const supplied = input.sealedSecrets ? await this.sdlSecretsService.receiveForMerge({ rawSdl: stored.sdl, sealedSecrets: input.sealedSecrets }) : {};
    const held = stored.sealedSecrets ? await this.sdlSecretsService.openStored({ userId, dseq, sealedSecrets: stored.sealedSecrets }) : {};
    const merged = this.#mergeAndPrune({ held, supplied, derived }, document);

    const { manifestVersion, manifest } = await this.#resolve(patchedSdl, merged, wallet);
    const deployment = await this.deploymentReaderService.findByWalletAndDseq(wallet, dseq);

    const recordedVersion = Buffer.from(manifestVersion).toString("base64");
    const sealedSecrets = await this.sdlSecretsService.sealForStorage({ userId, dseq, secrets: merged });

    const recordedId = await this.deploymentSettingRepository.accessibleBy(this.authService.ability, "update").replaceDefinitionIfVersionMatches({
      userId,
      dseq,
      sdl: patchedSdl,
      manifestVersion: recordedVersion,
      sealedSecrets,
      expectedManifestVersion: input.ifManifestVersion
    });

    if (!recordedId) {
      throw createError(409, "Deployment definition changed concurrently, please retry");
    }

    this.#logger.info({
      event: "DEPLOYMENT_PATCH_APPLIED",
      userId,
      dseq,
      patchedServiceCount: Object.keys(input.services).length,
      secretCount: Object.keys(merged).length,
      guarded: input.ifManifestVersion !== undefined
    });

    await this.#commitOnChain(wallet, dseq, manifestVersion, deployment);
    await this.#sendManifestToProviders({
      dseq,
      manifest: manifestToSortedJSON(manifest.groups),
      leases: deployment.leases,
      walletId: wallet.id
    });

    return { ...(await this.deploymentReaderService.findByWalletAndDseq(wallet, dseq)), manifestVersion: recordedVersion };
  }

  /** Read through the caller's own ability as well as their id, so a definition is unreachable by anyone the ability excludes even before the write re-checks it. */
  async #findStoredDefinition(key: { userId: string; dseq: string }): Promise<{ sdl: string; sealedSecrets: string | null }> {
    const setting = await this.deploymentSettingRepository.accessibleBy(this.authService.ability, "read").findOneBy(key);

    if (!setting?.sdl) {
      throw createError(404, NOT_PATCHABLE_MESSAGE);
    }

    return { sdl: setting.sdl, sealedSecrets: setting.sealedSecrets };
  }

  /** The caller did not supply this document, so an unparseable one is the console's fault and never a 400. */
  #parseStored(sdl: string, key: { userId: string; dseq: string }): StorableSdl {
    const parsed = parseSdlForStorage(sdl);

    if (parsed.document === null) {
      this.#logger.error({ event: "DEPLOYMENT_STORED_SDL_UNPARSEABLE", ...key });

      throw createError(500, "The SDL recorded for this deployment cannot be read");
    }

    return parsed;
  }

  /** Carries the parsed document's own `mayShareNodes` rather than assuming it, so the alias-safe size estimate runs only for a document that actually anchors something. */
  #serialize(parsed: StorableSdl, key: { userId: string; dseq: string }): string {
    const { sdl, length } = sdlForStorage(parsed, SDL_MAX_LENGTH);

    if (sdl === null) {
      this.#logger.warn({ event: "DEPLOYMENT_PATCHED_SDL_TOO_LARGE", ...key, length, maxLength: SDL_MAX_LENGTH });

      throw createError(400, `The patched SDL is too large: it exceeds the maximum of ${SDL_MAX_LENGTH} characters once stored`);
    }

    return sdl;
  }

  /**
   * The one set the patched deployment's token carries: what it already held, overlaid by what the
   * request supplied and then by what the patched document itself gave up, pruned to exactly the names
   * the document still references. A name the SDL no longer mentions is dropped rather than kept, and a
   * name it mentions with no value anywhere is left for the resolve below to refuse by name.
   */
  #mergeAndPrune(sets: { held: SdlSecrets; supplied: SdlSecrets; derived: SdlSecrets }, document: SDLInput): SdlSecrets {
    const overlaid: SdlSecrets = { ...sets.held, ...sets.supplied, ...sets.derived };
    const referenced = new Set(this.sdlReferenceService.declarationsOf(document, SECRET_REFERENCE_KIND).map(declaration => declaration.name));

    this.#assertEverySuppliedNameIsReferenced(sets.supplied, referenced);

    const merged = Object.fromEntries(Object.entries(overlaid).filter(([name]) => referenced.has(name)));

    this.sdlSecretsService.assertStorable(merged);

    return merged;
  }

  /**
   * A supplied name the patched SDL does not reference is refused rather than dropped, the same answer
   * a whole-SDL update gives: a misspelt name would otherwise be silently discarded and the caller
   * would believe a credential had rotated when nothing had changed.
   */
  #assertEverySuppliedNameIsReferenced(supplied: SdlSecrets, referenced: ReadonlySet<string>): void {
    const unreferenced = Object.keys(supplied).filter(name => !referenced.has(name));

    if (unreferenced.length > 0) {
      throw this.#rejectInvalidSdl(unreferenced.map(unreferencedNameError));
    }
  }

  /** Resolves the serialized document rather than the tree it came from, so what the manifest version commits to is exactly the bytes recorded below it. */
  async #resolve(sdl: string, secrets: SdlSecrets, wallet: WalletInitialized) {
    const result = await this.sdlService.generateResolvedManifest({ sdl, secrets, isTrialing: !!wallet.isTrialing });

    if (!result.ok) {
      throw this.#rejectInvalidSdl(result.value);
    }

    return result.value;
  }

  #rejectInvalidSdl(errors: ValidationError[]) {
    return createError(400, `Invalid SDL: ${errors.map(error => error.message).join(", ")}`);
  }

  async #commitOnChain(wallet: WalletInitialized, dseq: string, manifestVersion: Uint8Array, deployment: DeploymentResponse): Promise<void> {
    if (Buffer.from(manifestVersion).toString("base64") === deployment.deployment.hash) return;

    const message = this.rpcMessageService.getUpdateDeploymentMsg({ owner: wallet.address, dseq, hash: manifestVersion });

    await this.signerService.executeDerivedDecodedTxByUserId(wallet.userId, [message]);
  }

  async #sendManifestToProviders(options: { dseq: string; manifest: string; leases: DeploymentResponse["leases"]; walletId: number }): Promise<void> {
    const { leases, walletId, ...rest } = options;

    for (const provider of new Set(leases.map(lease => lease.id.provider))) {
      await this.providerService.sendManifest({
        provider,
        ...rest,
        auth: await this.providerService.toProviderAuth({ walletId, provider })
      });
    }
  }
}
