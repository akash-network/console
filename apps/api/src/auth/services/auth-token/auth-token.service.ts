import jwt from "jsonwebtoken";
import { singleton } from "tsyringe";
import { z } from "zod";

import { AuthConfig, InjectAuthConfig } from "@src/auth/providers/config.provider";

@singleton()
export class AuthTokenService {
  private readonly PayloadSchema = z.object({
    sub: z.string(),
    type: z.literal("ANONYMOUS")
  });

  constructor(@InjectAuthConfig() private readonly config: AuthConfig) {}

  signTokenFor(input: { id: string }): string {
    return jwt.sign({ sub: input.id, type: "ANONYMOUS" }, this.config.ANONYMOUS_USER_TOKEN_SECRET);
  }

  async getValidUserId(bearer: string): Promise<string | undefined> {
    const token = bearer.replace(/^Bearer\s+/i, "");
    const payload = await this.decodeToken(token);

    if (payload) {
      jwt.verify(token, this.config.ANONYMOUS_USER_TOKEN_SECRET);

      return payload.sub;
    }
  }

  private async decodeToken(token: string): Promise<z.infer<typeof this.PayloadSchema> | undefined> {
    const payload = jwt.decode(token);
    const { success, data } = await this.PayloadSchema.safeParseAsync(payload);

    return success ? data : undefined;
  }
}
