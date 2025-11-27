import type { HttpClient } from "@akashnetwork/http-sdk";

import { ONBOARDING_STEP_KEY } from "../../storage/keys";

export class AuthService {
  constructor(
    private readonly urlService: AuthUrlService,
    private readonly internalApiHttpClient: HttpClient,
    private readonly location = window.location,
    private readonly localStorage = window.localStorage
  ) {}

  async signup(options?: { returnTo?: string }): Promise<void> {
    const params = new URLSearchParams();
    if (options?.returnTo) params.append("returnTo", options.returnTo);

    await this.internalApiHttpClient.get<void>(this.urlService.signup(), {
      fetchOptions: {
        redirect: "manual"
      }
    });
    const queryParams = params.toString();
    // redirect user to the same url because it's impossible to read Location header in browser
    this.location.assign(this.urlService.signup() + (queryParams ? `?${queryParams}` : ""));
  }

  logout() {
    this.localStorage.removeItem(ONBOARDING_STEP_KEY);
    this.location.assign(this.urlService.logout());
  }
}

export interface AuthUrlService {
  signup(): string;
  logout(): string;
}
