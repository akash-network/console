import { AuthHttpService, TxHttpService, UserHttpService } from "@akashnetwork/http-sdk";
import { StripeService } from "@akashnetwork/http-sdk/src/stripe/stripe.service";
import { TemplateHttpService } from "@akashnetwork/http-sdk/src/template/template-http.service";
import { event } from "nextjs-google-analytics";

import type { BrowserEnvConfig, ServerEnvConfig } from "@src/config/env-config.schema";
import { authService } from "@src/services/auth/auth.service";
import { AnalyticsCategory, AnalyticsEvents } from "@src/types/analytics";
import { customRegistry } from "@src/utils/customRegistry";

export const createServices = (config: Pick<ServerEnvConfig, "BASE_API_MAINNET_URL"> | Pick<BrowserEnvConfig, "NEXT_PUBLIC_BASE_API_MAINNET_URL">) => {
  const apiConfig = { baseURL: "BASE_API_MAINNET_URL" in config ? config.BASE_API_MAINNET_URL : config.NEXT_PUBLIC_BASE_API_MAINNET_URL };

  const user = new UserHttpService(apiConfig);
  const stripe = new StripeService(apiConfig);
  const tx = new TxHttpService(customRegistry, apiConfig);
  const template = new TemplateHttpService(apiConfig);
  const auth = new AuthHttpService(apiConfig);

  user.interceptors.request.use(authService.withAnonymousUserHeader);
  stripe.interceptors.request.use(authService.withAnonymousUserHeader);
  tx.interceptors.request.use(authService.withAnonymousUserHeader);
  auth.interceptors.request.use(authService.withAnonymousUserHeader);

  user.interceptors.response.use(response => {
    if (response.config.url?.startsWith("/v1/anonymous-users") && response.config.method === "post" && response.status === 200) {
      event(AnalyticsEvents.ANONYMOUS_USER_CREATED, { category: AnalyticsCategory.USER, label: "Anonymous User Created" });
    }
    return response;
  });

  return { user, stripe, tx, template, auth };
};
