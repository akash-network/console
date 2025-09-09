import { GetUsers200ResponseOneOfInner, ManagementClient } from "auth0";
import { inject, singleton } from "tsyringe";

import { AUTH0_MANAGEMENT_CLIENT } from "@src/core/providers/auth.provider";

@singleton()
export class Auth0Service {
  constructor(@inject(AUTH0_MANAGEMENT_CLIENT) private readonly managementClient: ManagementClient) {}

  async sendVerificationEmail(userId: string) {
    await this.managementClient.jobs.verifyEmail({ user_id: userId });
  }

  async getUserByEmail(email: string): Promise<GetUsers200ResponseOneOfInner | null> {
    const { data: users } = await this.managementClient.usersByEmail.getByEmail({ email });
    if (users.length === 0) {
      return null;
    }

    return users[0];
  }
}
