import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { SDL_SECRETS_REQUIRED_CLAIMS } from "@src/deployment/config/sdl-secrets.config";
import type { SdlSecretsPublicJwk } from "@src/deployment/services/sdl-secrets-sealing-key/sdl-secrets-sealing-key.service";
import { SdlSecretsSealingKeyService } from "@src/deployment/services/sdl-secrets-sealing-key/sdl-secrets-sealing-key.service";

export type { SdlSecretsPublicJwk };

export interface SdlSecretsContext {
  kid: string;
  sub: string;
  jwk: SdlSecretsPublicJwk;
  requiredClaims: Array<(typeof SDL_SECRETS_REQUIRED_CLAIMS)[number]>;
}

@singleton()
export class SdlSecretsContextService {
  constructor(
    private readonly sealingKeyService: SdlSecretsSealingKeyService,
    private readonly authService: AuthService
  ) {}

  async getContext(): Promise<SdlSecretsContext> {
    const { kid, jwk } = await this.sealingKeyService.getSealingKey();

    return {
      kid,
      sub: this.authService.currentUser.id,
      jwk,
      requiredClaims: [...SDL_SECRETS_REQUIRED_CLAIMS]
    };
  }
}
