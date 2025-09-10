import { ManagementClient } from "auth0";
import { container } from "tsyringe";

import { AuthConfigService } from "@src/auth/services/auth-config/auth-config.service";

let managementClientInstance: ManagementClient | null = null;

container.register(ManagementClient, {
  useFactory: () => {
    if (!managementClientInstance) {
      const authConfig = container.resolve(AuthConfigService);

      managementClientInstance = new ManagementClient({
        domain: authConfig.get("AUTH0_M2M_DOMAIN"),
        clientId: authConfig.get("AUTH0_M2M_CLIENT_ID"),
        clientSecret: authConfig.get("AUTH0_M2M_SECRET")
      });
    }

    return managementClientInstance;
  }
});
