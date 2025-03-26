import { singleton } from "tsyringe";

import { AuthConfigService } from "@src/auth/services/auth-config/auth-config.service";

@singleton()
export class FeaturesService {
  constructor(private readonly configService: AuthConfigService) {}

  async getEnabledFeatures(): Promise<Record<string, boolean>> {
    return {
      allowAnonymousUserTrial: this.configService.get("ALLOW_ANONYMOUS_USER_TRIAL")
    };
  }
}
