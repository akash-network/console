import type { SDLInput, ValidationError } from "@akashnetwork/chain-sdk";
import type { AnyAbility } from "@casl/ability";
import createError, { isHttpError } from "http-errors";
import { singleton } from "tsyringe";

import type { WalletInitialized } from "@src/billing/repositories";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import { SDL_MAX_LENGTH } from "@src/deployment/config/sdl.config";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { DeploymentReaderService } from "@src/deployment/services/deployment-reader/deployment-reader.service";
import { SdlService } from "@src/deployment/services/sdl/sdl.service";
import { ownValue, SdlReferenceService } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import { SdlSecretsService } from "@src/deployment/services/sdl-secrets/sdl-secrets.service";
import { SdlSecretsDerivationService, sealedEnvOf } from "@src/deployment/services/sdl-secrets-derivation/sdl-secrets-derivation.service";
import { SdlSecretsInheritanceService } from "@src/deployment/services/sdl-secrets-inheritance/sdl-secrets-inheritance.service";
import type { SdlSecrets } from "@src/deployment/services/sdl-secrets-unsealer/sdl-secrets-unsealer.service";
import { findGroupWithChangedResources } from "@src/deployment/utils/changed-group-resources/changed-group-resources";
import { mayShareNodesOf, parseSdlForStorage, sdlForStorage, STORED_SDL_TOO_LARGE_MESSAGE } from "@src/deployment/utils/sdl-for-storage/sdl-for-storage";
import { findMissingGlobalExposure } from "@src/deployment/utils/sdl-manifest/sdl-manifest";

const SECRET_REFERENCE_KIND = "secret";

export type DefinitionError = { path: string; keyword: string; message: string };

export type DefinitionCheck = { valid: boolean; errors: DefinitionError[]; keptSecrets: string[] };

export type DefinitionCheckInput = { sdl: string; sealedSecrets?: string; secretEnv?: string[]; inheritSecretsFrom?: string };

type CheckContext = { wallet: WalletInitialized; held: SdlSecrets; storedDocument?: SDLInput; dseq?: string };

function valuesNamed(secrets: SdlSecrets, names: string[]): SdlSecrets {
  return Object.fromEntries(names.flatMap(name => (Object.hasOwn(secrets, name) ? [[name, secrets[name]]] : [])));
}

function errorOf(error: ValidationError): DefinitionError {
  return { path: error.instancePath, keyword: error.keyword, message: error.message };
}

/** Runs the checks a create or a replacement would, collecting every error rather than stopping at the first, and writes, seals and sends nothing. */
@singleton()
export class DeploymentDefinitionCheckService {
  constructor(
    private readonly walletReaderService: WalletReaderService,
    private readonly signerService: ManagedSignerService,
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly deploymentReaderService: DeploymentReaderService,
    private readonly sdlService: SdlService,
    private readonly sdlReferenceService: SdlReferenceService,
    private readonly sdlSecretsService: SdlSecretsService,
    private readonly sdlSecretsDerivationService: SdlSecretsDerivationService,
    private readonly sdlSecretsInheritanceService: SdlSecretsInheritanceService
  ) {}

  async checkNew(userId: string, input: DefinitionCheckInput): Promise<DefinitionCheck> {
    const wallet = await this.walletReaderService.getWalletByUserId(userId);
    const held = input.inheritSecretsFrom ? await this.sdlSecretsInheritanceService.open({ wallet, dseq: input.inheritSecretsFrom }) : {};

    return await this.#check(input, { wallet, held });
  }

  async checkReplacement(userId: string, dseq: string, input: Omit<DefinitionCheckInput, "inheritSecretsFrom">, ability: AnyAbility): Promise<DefinitionCheck> {
    const wallet = await this.walletReaderService.getWalletByUserId(userId);
    const filedUserId = await this.signerService.filedUserIdOf(wallet, userId, dseq);
    const setting = await this.deploymentSettingRepository.accessibleBy(ability, "read").findOneBy({ userId: filedUserId, dseq });

    if (!setting?.sdl) {
      throw createError(404, "This deployment has no SDL recorded by the console, so there is nothing to check a replacement against");
    }

    const storedDocument = parseSdlForStorage(setting.sdl).document;

    if (!storedDocument) {
      throw createError(500, "The SDL recorded for this deployment cannot be read", { errorCode: "stored_sdl_unreadable" });
    }

    const held = setting.sealedSecrets
      ? await this.sdlSecretsService.openStored({
          userId: filedUserId,
          organizationId: setting.organizationId ?? null,
          dseq,
          sealedSecrets: setting.sealedSecrets
        })
      : {};

    return await this.#check(input, { wallet, held, storedDocument, dseq });
  }

  async #check(input: DefinitionCheckInput, context: CheckContext): Promise<DefinitionCheck> {
    const parsed = this.sdlService.parse(input.sdl);

    if (!parsed.ok) return { valid: false, errors: parsed.value.map(errorOf), keptSecrets: [] };

    const document = parsed.value;
    const errors = [
      ...this.sdlReferenceService.validate(document).map(errorOf),
      ...(await this.#manifestErrorsOf(document, context)),
      ...this.#unsetSecretEnvErrorsOf(document, input, context)
    ];
    const received = await this.sdlSecretsService.receive({ sdl: document, rawSdl: input.sdl, sealedSecrets: input.sealedSecrets, inherited: context.held });
    const supplied = received.ok ? received.value : {};

    if (!received.ok) errors.push(...received.value.map(errorOf));

    errors.push(...this.#storageErrorsOf(document, input, { ...context, supplied }));

    const keptSecrets = this.#referencedNamesOf(document).filter(name => !Object.hasOwn(supplied, name) && ownValue(context.held, name) !== undefined);

    return { valid: errors.length === 0, errors, keptSecrets };
  }

  async #manifestErrorsOf(document: SDLInput, context: CheckContext): Promise<DefinitionError[]> {
    const manifest = await this.sdlService.generateManifestFrom(structuredClone(document), { isTrialing: !!context.wallet.isTrialing });

    if (!manifest.ok) return manifest.value.map(errorOf);

    const missingGlobalExposure = findMissingGlobalExposure(manifest.value.groups);
    const errors = missingGlobalExposure ? [errorOf(missingGlobalExposure)] : [];

    if (context.dseq === undefined) return errors;

    const { groupSpecs } = await this.deploymentReaderService.findWithGroupSpecsByWalletAndDseq(context.wallet, context.dseq);
    const changedGroup = groupSpecs && findGroupWithChangedResources(manifest.value.groupSpecs, groupSpecs);

    if (changedGroup) {
      errors.push({
        path: "/deployment",
        keyword: "deployment_resources_changed",
        message: `The SDL changes the resources of group "${changedGroup}", which only a new deployment can take: a running deployment's groups, compute resources, replica counts and globally exposed ports are fixed`
      });
    }

    return errors;
  }

  #unsetSecretEnvErrorsOf(document: SDLInput, input: DefinitionCheckInput, context: CheckContext): DefinitionError[] {
    const unset = this.sdlSecretsDerivationService.unsetEnvVariablesOf(document, {
      sealedEnv: sealedEnvOf(input),
      onlyAt: this.#positionsToDerive(document, input, context)
    });

    return unset.map(variable => ({
      path: "/secretEnv",
      keyword: "secretEnv",
      message: `"${variable}" is listed in secretEnv, but the request sets no environment variable of that name`
    }));
  }

  /** Measured on the document and the secret sets the write would measure, so a definition this answers as storable is never refused for its size on the way in. */
  #storageErrorsOf(document: SDLInput, input: DefinitionCheckInput, context: CheckContext & { supplied: SdlSecrets }): DefinitionError[] {
    const storedDocument = structuredClone(document);
    const derived = this.sdlSecretsDerivationService.derive(storedDocument, {
      sealedEnv: sealedEnvOf(input),
      onlyAt: this.#positionsToDerive(document, input, context)
    });

    return [
      ...this.#storedSdlSizeErrorsOf(storedDocument, input.sdl),
      ...this.#secretBoundErrorsOf({ held: context.held, supplied: context.supplied, derived }, this.#referencedNamesOf(storedDocument), context)
    ];
  }

  #storedSdlSizeErrorsOf(storedDocument: SDLInput, rawSdl: string): DefinitionError[] {
    const { sdl } = sdlForStorage({ document: storedDocument, mayShareNodes: mayShareNodesOf(rawSdl) }, SDL_MAX_LENGTH);

    return sdl === null ? [{ path: "", keyword: "maxLength", message: STORED_SDL_TOO_LARGE_MESSAGE }] : [];
  }

  /** A create bounds only what the deployment keeps from elsewhere, while a replacement also bounds the whole set it stores, each stopping at its first refusal as the write does. */
  #secretBoundErrorsOf(sets: { held: SdlSecrets; supplied: SdlSecrets; derived: SdlSecrets }, referenced: string[], context: CheckContext): DefinitionError[] {
    const carried = valuesNamed(
      { ...sets.held, ...sets.supplied },
      referenced.filter(name => !Object.hasOwn(sets.derived, name))
    );
    const bounds: [SdlSecrets, "carried" | "stored"][] = [[carried, "carried"]];

    if (context.storedDocument) bounds.push([valuesNamed({ ...sets.held, ...sets.supplied, ...sets.derived }, referenced), "stored"]);

    for (const [secrets, origin] of bounds) {
      try {
        this.sdlSecretsService.assertStorable(secrets, origin);
      } catch (error) {
        if (isHttpError(error) && error.status === 400) return [{ path: "", keyword: "secrets", message: error.message }];
        throw error;
      }
    }

    return [];
  }

  #positionsToDerive(document: SDLInput, input: DefinitionCheckInput, context: CheckContext): ReadonlySet<string> | undefined {
    return context.storedDocument
      ? this.sdlSecretsDerivationService.positionsToDeriveOnReplace({ document, storedDocument: context.storedDocument, secretEnv: input.secretEnv })
      : undefined;
  }

  #referencedNamesOf(document: SDLInput): string[] {
    return [...new Set(this.sdlReferenceService.declarationsOf(document, SECRET_REFERENCE_KIND).map(declaration => declaration.name))];
  }
}
