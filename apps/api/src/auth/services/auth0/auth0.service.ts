import { ManagementClient } from "auth0";
import { singleton } from "tsyringe";

import { AuthConfigService } from "@src/auth/services/auth-config/auth-config.service";

@singleton()
export class Auth0Service {
  private readonly managementClient: ManagementClient;

  constructor(private readonly authConfig: AuthConfigService) {
    this.managementClient = new ManagementClient({
      domain: this.authConfig.get("AUTH0_M2M_DOMAIN"),
      clientId: this.authConfig.get("AUTH0_M2M_CLIENT_ID"),
      clientSecret: this.authConfig.get("AUTH0_M2M_SECRET")
    });
  }

  async sendVerificationEmail(userId: string) {
    await this.managementClient.jobs.verifyEmail({ user_id: userId });
  }
}
