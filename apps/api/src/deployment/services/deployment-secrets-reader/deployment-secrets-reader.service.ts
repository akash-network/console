import createError from "http-errors";
import { inject, singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import type { DeploymentSecretUsage, ListDeploymentSecretsResponse } from "@src/deployment/http-schemas/deployment-secret.schema";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { SdlReferenceService, type SdlReferenceUsage } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import { parseSdlForStorage, STORED_SDL_UNREADABLE_ERROR_CODE } from "@src/deployment/utils/sdl-for-storage/sdl-for-storage";

const SECRET_REFERENCE_KIND = "secret";

type DeploymentSecrets = ListDeploymentSecretsResponse["data"]["secrets"];

/** Reads secret names off the stored SDL alone, so listing them never opens the sealed values. */
@singleton()
export class DeploymentSecretsReaderService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly walletReaderService: WalletReaderService,
    private readonly signerService: ManagedSignerService,
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly authService: AuthService,
    private readonly sdlReferenceService: SdlReferenceService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: DeploymentSecretsReaderService.name });
  }

  /** Answers a deployment the caller cannot read and one the console holds no definition for with the same 404, so a refusal never confirms which. */
  async listByUserIdAndDseq(userId: string, dseq: string): Promise<{ secrets: DeploymentSecrets }> {
    const sdl = await this.#findRecordedSdl(userId, dseq);

    if (!sdl) {
      throw createError(404, "Deployment not found");
    }

    return { secrets: secretsOf(this.sdlReferenceService.usagesOf(this.#parseStored(sdl, { userId, dseq }), SECRET_REFERENCE_KIND)) };
  }

  /** Scoped like reading the deployment's definition: the wallet the caller may read, the project scope of the request, and the caller's ability over the setting row. */
  async #findRecordedSdl(userId: string, dseq: string): Promise<string | null> {
    const wallet = await this.walletReaderService.findReadableWalletByUserId(userId);

    if (!wallet || !(await this.signerService.isDeploymentInProjectScope(wallet, dseq, "read"))) {
      return null;
    }

    const setting = await this.deploymentSettingRepository.accessibleBy(this.authService.ability, "read").findOneOfWallet(wallet, dseq);

    return setting?.sdl && setting.manifestVersion ? setting.sdl : null;
  }

  /** Attaches no parse error as a cause, because a `js-yaml` message quotes the line it failed on and the error handler logs the whole chain. */
  #parseStored(sdl: string, key: { userId: string; dseq: string }) {
    const parsed = parseSdlForStorage(sdl);

    if (parsed.document === null) {
      this.logger.error({ event: "DEPLOYMENT_STORED_SDL_UNPARSEABLE", ...key });

      throw createError(500, "The SDL recorded for this deployment cannot be read", { errorCode: STORED_SDL_UNREADABLE_ERROR_CODE });
    }

    return parsed.document;
  }
}

function secretsOf(usages: SdlReferenceUsage[]): DeploymentSecrets {
  const names = [...new Set(usages.map(usage => usage.name))].sort();

  return names.map(name => ({ name, usedBy: usages.filter(usage => usage.name === name).map(secretUsageOf) }));
}

function secretUsageOf({ slot }: SdlReferenceUsage): DeploymentSecretUsage {
  return slot.credentialField === undefined
    ? { service: slot.serviceName, env: slot.envVariable }
    : { service: slot.serviceName, credential: slot.credentialField };
}
