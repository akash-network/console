import { ManagementClient } from "auth0";
import { container, singleton } from "tsyringe";

import { AuthConfigService } from "@src/auth/services/auth-config/auth-config.service";

@singleton()
class ManagementClientFactory {
  private static instance: ManagementClient | null = null;

  static getInstance(): ManagementClient {
    if (!ManagementClientFactory.instance) {
      const authConfig = container.resolve(AuthConfigService);
      ManagementClientFactory.instance = new ManagementClient({
        domain: authConfig.get("AUTH0_M2M_DOMAIN"),
        clientId: authConfig.get("AUTH0_M2M_CLIENT_ID"),
        clientSecret: authConfig.get("AUTH0_M2M_SECRET")
      });
    }

    return ManagementClientFactory.instance;
  }
}

container.register(ManagementClient, {
  useFactory: () => ManagementClientFactory.getInstance()
});
