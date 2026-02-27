import { GetUsers200ResponseOneOfInner, ManagementClient } from "auth0";
import { singleton } from "tsyringe";

@singleton()
export class Auth0Service {
  constructor(private readonly managementClient: ManagementClient) {}

  async createUser(input: { email: string; password: string; connection: string }): Promise<void> {
    await this.managementClient.users.create({
      email: input.email,
      password: input.password,
      connection: input.connection,
      verify_email: false
    });
  }

  async sendVerificationEmail(userId: string) {
    await this.managementClient.jobs.verifyEmail({ user_id: userId });
  }

  async markEmailVerified(userId: string) {
    await this.managementClient.users.update({ id: userId }, { email_verified: true });
  }

  async getUserByEmail(email: string): Promise<GetUsers200ResponseOneOfInner | null> {
    const { data: users } = await this.managementClient.usersByEmail.getByEmail({ email });
    if (users.length === 0) {
      return null;
    }

    return users[0];
  }
}
