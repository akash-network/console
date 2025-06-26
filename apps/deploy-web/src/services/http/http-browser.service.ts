import { browserEnvConfig } from "@src/config/browser-env.config";
import { createServices } from "@src/services/http-factory/http-factory.service";

export const services = createServices({
  BASE_API_MAINNET_URL: browserEnvConfig.NEXT_PUBLIC_BASE_API_MAINNET_URL,
  BASE_PROVIDER_PROXY_URL: browserEnvConfig.NEXT_PUBLIC_PROVIDER_PROXY_URL
});

/**
 * @deprecated use useServices() instead
 */
export const userHttpService = services.user;
/**
 * @deprecated use useServices() instead
 */
export const stripeService = services.stripe;
/**
 * @deprecated use useServices() instead
 */
export const txHttpService = services.tx;
