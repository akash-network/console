import { ManagementClient } from "auth0";

import { testEnvConfig } from "../fixture/test-env.config";

export class Auth0ManagementService {
  private readonly managementClient = new ManagementClient({
    domain: testEnvConfig.AUTH0_M2M_DOMAIN,
    clientId: testEnvConfig.AUTH0_M2M_CLIENT_ID,
    clientSecret: testEnvConfig.AUTH0_M2M_CLIENT_SECRET
  });

  async createEmailVerificationTicket(userId: string, resultUrl: string): Promise<string> {
    const { data } = await this.managementClient.tickets.verifyEmail({
      user_id: userId,
      result_url: resultUrl
    });
    return data.ticket;
  }

  async deleteUser(userId: string): Promise<void> {
    await this.managementClient.users.delete({ id: userId });
  }

  async getUserByEmail(email: string): Promise<{ user_id: string } | null> {
    const { data: users } = await this.managementClient.usersByEmail.getByEmail({ email });
    return users.length > 0 ? users[0] : null;
  }
}
