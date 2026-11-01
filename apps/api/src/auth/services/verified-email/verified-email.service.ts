import { singleton } from "tsyringe";

import { Auth0Service } from "@src/auth/services/auth0/auth0.service";
import { Memoize } from "@src/caching/helpers";

const MAX_CACHED_USERS = 10_000;

/** Reads the address and its verification from Auth0, never from the user row. */
@singleton()
export class VerifiedEmailService {
  constructor(private readonly auth0Service: Auth0Service) {}

  async getEmail(userId: string): Promise<{ email: string; emailVerified: boolean } | null> {
    const user = await this.auth0Service.getUser(userId);

    return user?.email ? { email: user.email, emailVerified: user.email_verified === true } : null;
  }

  async getVerifiedEmail(userId: string): Promise<string | null> {
    const email = await this.getEmail(userId);

    return email?.emailVerified ? email.email.trim().toLowerCase() : null;
  }

  /** May trail an email change by a minute, which suits reads a client repeats on a timer and spares Auth0's rate limit. */
  @Memoize({ ttlInSeconds: 60, maxEntries: MAX_CACHED_USERS })
  async getRecentVerifiedEmail(userId: string): Promise<string | null> {
    return await this.getVerifiedEmail(userId);
  }
}
