import type { HttpClient } from "@akashnetwork/http-sdk";

import { forgetInvitationToken } from "@src/lib/organization-invitation/invitation-token-storage";

export class AuthService {
  readonly #cacheStorage: CacheStorage | undefined;

  constructor(
    private readonly urlService: AuthUrlService,
    private readonly internalApiHttpClient: HttpClient,
    private readonly location = window.location,
    cacheStorage: CacheStorage | undefined = globalThis.caches
  ) {
    this.#cacheStorage = cacheStorage;
  }

  async loginViaOauth(options?: { returnTo?: string; connection?: string }): Promise<void> {
    const params = new URLSearchParams();
    if (options?.returnTo) params.append("returnTo", options.returnTo);
    if (options?.connection) params.append("connection", options.connection);

    const queryParams = params.toString();
    // redirect user to the same url because it's impossible to read Location header in browser
    this.location.assign(this.urlService.signup() + (queryParams ? `?${queryParams}` : ""));
  }

  async login(input: { email: string; password: string; captchaToken: string }): Promise<void> {
    await this.internalApiHttpClient.post<void>("/api/auth/password-login", {
      email: input.email,
      password: input.password,
      captchaToken: input.captchaToken
    });
  }

  async signup(input: { email: string; password: string; termsAndConditions: boolean; captchaToken: string }): Promise<void> {
    await this.internalApiHttpClient.post<void>("/api/auth/password-signup", {
      email: input.email,
      password: input.password,
      termsAndConditions: input.termsAndConditions,
      captchaToken: input.captchaToken
    });
  }

  async startEmailCode(input: { email: string; captchaToken: string }): Promise<void> {
    await this.internalApiHttpClient.post<void>("/api/auth/email-code-start", {
      email: input.email,
      captchaToken: input.captchaToken
    });
  }

  async verifyEmailCode(input: { email: string; code: string; captchaToken: string }): Promise<void> {
    await this.internalApiHttpClient.post<void>("/api/auth/email-code-verify", {
      email: input.email,
      code: input.code,
      captchaToken: input.captchaToken
    });
  }

  async sendPasswordResetEmail(input: { email: string; captchaToken: string }): Promise<void> {
    await this.internalApiHttpClient.post<void>("/api/auth/send-password-reset-email", {
      email: input.email,
      captchaToken: input.captchaToken
    });
  }

  async logout(): Promise<void> {
    forgetInvitationToken();
    await this.#forgetCachedResponses();
    this.location.assign(this.urlService.logout());
  }

  /** Best effort, because a browser that refuses Cache Storage still has to finish signing out. */
  async #forgetCachedResponses(): Promise<void> {
    const cacheStorage = this.#cacheStorage;
    if (!cacheStorage) return;

    const cacheNames = await cacheStorage.keys().catch(() => []);
    await Promise.allSettled(cacheNames.map(cacheName => cacheStorage.delete(cacheName)));
  }
}

export interface AuthUrlService {
  signup(): string;
  logout(): string;
}
