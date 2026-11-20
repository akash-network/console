import type { SDLInput, ValidationError } from "@akashnetwork/chain-sdk";
import type { AnyAbility } from "@casl/ability";
import createError, { isHttpError } from "http-errors";
import { singleton } from "tsyringe";

import type { WalletInitialized } from "@src/billing/repositories";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { DeploymentReaderService } from "@src/deployment/services/deployment-reader/deployment-reader.service";
import { SdlService } from "@src/deployment/services/sdl/sdl.service";
import { ownValue, SdlReferenceService } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import { SdlSecretsService } from "@src/deployment/services/sdl-secrets/sdl-secrets.service";
import { SdlSecretsDerivationService, sealedEnvOf } from "@src/deployment/services/sdl-secrets-derivation/sdl-secrets-derivation.service";
import { SdlSecretsInheritanceService } from "@src/deployment/services/sdl-secrets-inheritance/sdl-secrets-inheritance.service";
import type { SdlSecrets } from "@src/deployment/services/sdl-secrets-unsealer/sdl-secrets-unsealer.service";
import { findGroupWithChangedResources } from "@src/deployment/utils/changed-group-resources/changed-group-resources";
import { parseSdlForStorage } from "@src/deployment/utils/sdl-for-storage/sdl-for-storage";
import { findMissingGlobalExposure } from "@src/deployment/utils/sdl-manifest/sdl-manifest";

const SECRET_REFERENCE_KIND = "secret";

export type DefinitionProblem = { path: string; keyword: string; message: string };

export type DefinitionCheck = { valid: boolean; problems: DefinitionProblem[]; keptSecrets: string[] };

export type DefinitionCheckInput = { sdl: string; sealedSecrets?: string; secretEnv?: string[]; inheritSecretsFrom?: string };

type CheckContext = { wallet: WalletInitialized; held: SdlSecrets; storedDocument?: SDLInput; dseq?: string };

function problemOf(error: ValidationError): DefinitionProblem {
  return { path: error.instancePath, keyword: error.keyword, message: error.message };
}

/** Runs the checks a create or a replacement would, collecting every problem rather than stopping at the first, and writes, seals and sends nothing. */
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

    if (!parsed.ok) return { valid: false, problems: parsed.value.map(problemOf), keptSecrets: [] };

    const document = parsed.value;
    const problems = [
      ...this.sdlReferenceService.validate(document).map(problemOf),
      ...(await this.#manifestProblemsOf(document, context)),
      ...this.#unsetSecretEnvProblemsOf(document, input, context)
    ];
    const received = await this.sdlSecretsService.receive({ sdl: document, rawSdl: input.sdl, sealedSecrets: input.sealedSecrets, inherited: context.held });
    const supplied = received.ok ? received.value : {};

    if (!received.ok) problems.push(...received.value.map(problemOf));

    problems.push(...this.#storageProblemsOf(document, input, { ...context, supplied }));

    const keptSecrets = this.#referencedNamesOf(document).filter(name => !Object.hasOwn(supplied, name) && ownValue(context.held, name) !== undefined);

    return { valid: problems.length === 0, problems, keptSecrets };
  }

  async #manifestProblemsOf(document: SDLInput, context: CheckContext): Promise<DefinitionProblem[]> {
    const manifest = await this.sdlService.generateManifestFrom(structuredClone(document), { isTrialing: !!context.wallet.isTrialing });

    if (!manifest.ok) return manifest.value.map(problemOf);

    const missingGlobalExposure = findMissingGlobalExposure(manifest.value.groups);
    const problems = missingGlobalExposure ? [problemOf(missingGlobalExposure)] : [];

    if (context.dseq === undefined) return problems;

    const { groupSpecs } = await this.deploymentReaderService.findWithGroupSpecsByWalletAndDseq(context.wallet, context.dseq);
    const changedGroup = groupSpecs && findGroupWithChangedResources(manifest.value.groupSpecs, groupSpecs);

    if (changedGroup) {
      problems.push({
        path: "/deployment",
        keyword: "deployment_resources_changed",
        message: `The SDL changes the resources of group "${changedGroup}", which only a new deployment can take: a running deployment's groups, compute resources, replica counts and globally exposed ports are fixed`
      });
    }

    return problems;
  }

  #unsetSecretEnvProblemsOf(document: SDLInput, input: DefinitionCheckInput, context: CheckContext): DefinitionProblem[] {
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

  /** Measured on the very set a write would seal, so a definition this answers as storable is never refused for its size on the way in. */
  #storageProblemsOf(document: SDLInput, input: DefinitionCheckInput, context: CheckContext & { supplied: SdlSecrets }): DefinitionProblem[] {
    const sealed = structuredClone(document);
    const derived = this.sdlSecretsDerivationService.derive(sealed, {
      sealedEnv: sealedEnvOf(input),
      onlyAt: this.#positionsToDerive(document, input, context)
    });
    const carried: SdlSecrets = { ...context.held, ...context.supplied, ...derived };
    const stored = Object.fromEntries(this.#referencedNamesOf(sealed).flatMap(name => (Object.hasOwn(carried, name) ? [[name, carried[name]]] : [])));

    try {
      this.sdlSecretsService.assertStorable(stored, "stored");
      return [];
    } catch (error) {
      if (isHttpError(error) && error.status === 400) return [{ path: "", keyword: "secrets", message: error.message }];
      throw error;
    }
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
