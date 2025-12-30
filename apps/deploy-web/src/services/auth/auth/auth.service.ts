import type { HttpClient } from "@akashnetwork/http-sdk";
import type { InternalAxiosRequestConfig } from "axios";

import { ANONYMOUS_USER_TOKEN_KEY } from "@src/config/auth.config";
import { ONBOARDING_STEP_KEY } from "../../storage/keys";

export class AuthService {
  constructor(
    private readonly urlService: AuthUrlService,
    private readonly internalApiHttpClient: HttpClient,
    private readonly location = window.location,
    private readonly localStorage = window.localStorage
  ) {}

  async loginViaOauth(options?: { returnTo?: string; connection?: string }): Promise<void> {
    const params = new URLSearchParams();
    if (options?.returnTo) params.append("returnTo", options.returnTo);
    if (options?.connection) params.append("connection", options.connection);

    // send http request to store anonymous user token in a cookie
    // this is is needed only when anonymous free trial is enabled
    await this.internalApiHttpClient.get<void>(this.urlService.signup(), {
      fetchOptions: {
        redirect: "manual"
      }
    });
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

  async sendPasswordResetEmail(input: { email: string; captchaToken: string }): Promise<void> {
    await this.internalApiHttpClient.post<void>("/api/auth/send-password-reset-email", {
      email: input.email,
      captchaToken: input.captchaToken
    });
  }

  logout() {
    this.localStorage.removeItem(ANONYMOUS_USER_TOKEN_KEY);
    this.localStorage.removeItem(ONBOARDING_STEP_KEY);
    this.location.assign(this.urlService.logout());
  }
}

export interface AuthUrlService {
  signup(): string;
  logout(): string;
}

export function withAnonymousUserToken(config: InternalAxiosRequestConfig) {
  const token = typeof localStorage !== "undefined" ? localStorage.getItem(ANONYMOUS_USER_TOKEN_KEY) : null;

  if (token) {
    config.headers.set("authorization", `Bearer ${token}`);
  }

  return config;
}

export function withUserToken(config: InternalAxiosRequestConfig) {
  const token = typeof localStorage !== "undefined" ? localStorage.getItem(ANONYMOUS_USER_TOKEN_KEY) : null;

  if (token) {
    config.headers.set("authorization", `Bearer ${token}`);
  } else {
    config.baseURL = "/api/proxy";
  }

  return config;
}
