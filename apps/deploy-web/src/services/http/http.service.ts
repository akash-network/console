import { TxHttpService, UserHttpService } from "@akashnetwork/http-sdk";
import { StripeService } from "@akashnetwork/http-sdk/src/stripe/stripe.service";
import { event } from "nextjs-google-analytics";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { authService } from "@src/services/auth/auth.service";
import { AnalyticsCategory, AnalyticsEvents } from "@src/types/analytics";
import { customRegistry } from "@src/utils/customRegistry";

const apiConfig = { baseURL: browserEnvConfig.NEXT_PUBLIC_API_BASE_URL };

export const userHttpService = new UserHttpService(apiConfig);
export const stripeService = new StripeService(apiConfig);
export const txHttpService = new TxHttpService(customRegistry, apiConfig);

userHttpService.interceptors.request.use(authService.withAnonymousUserHeader);
stripeService.interceptors.request.use(authService.withAnonymousUserHeader);
txHttpService.interceptors.request.use(authService.withAnonymousUserHeader);

userHttpService.interceptors.response.use(response => {
  if (response.config.url?.startsWith("/v1/anonymous-users") && response.config.method === "post" && response.status === 200) {
    event(AnalyticsEvents.ANONYMOUS_USER_CREATED, { category: AnalyticsCategory.USER, label: "Anonymous User Created" });
  }
  return response;
});
