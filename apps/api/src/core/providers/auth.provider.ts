import { ManagementClient } from "auth0";
import type { InjectionToken } from "tsyringe";
import { container } from "tsyringe";

import { AuthConfigService } from "@src/auth/services/auth-config/auth-config.service";

export const AUTH0_MANAGEMENT_CLIENT: InjectionToken<ManagementClient> = Symbol("AUTH0_MANAGEMENT_CLIENT");

container.register(AUTH0_MANAGEMENT_CLIENT, {
  useFactory: dependencyContainer => {
    const authConfig = dependencyContainer.resolve(AuthConfigService);
    return new ManagementClient({
      domain: authConfig.get("AUTH0_M2M_DOMAIN"),
      clientId: authConfig.get("AUTH0_M2M_CLIENT_ID"),
      clientSecret: authConfig.get("AUTH0_M2M_SECRET")
    });
  }
});
