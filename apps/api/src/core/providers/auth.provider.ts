import { ManagementClient } from "auth0";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { AuthConfigService } from "@src/auth/services/auth-config/auth-config.service";

let managementClientInstance: ManagementClient | null = null;

container.register(ManagementClient, {
  useFactory: instancePerContainerCachingFactory(c => {
    if (!managementClientInstance) {
      const authConfig = c.resolve(AuthConfigService);

      managementClientInstance = new ManagementClient({
        domain: authConfig.get("AUTH0_M2M_DOMAIN"),
        clientId: authConfig.get("AUTH0_M2M_CLIENT_ID"),
        clientSecret: authConfig.get("AUTH0_M2M_SECRET")
      });
    }

    return managementClientInstance;
  })
});
