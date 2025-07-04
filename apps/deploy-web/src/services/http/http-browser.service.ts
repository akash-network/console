import { browserEnvConfig } from "@src/config/browser-env.config";
import { createServices } from "@src/services/http-factory/http-factory.service";
import { browserApiUrlService } from "../api-url/browser-api-url.service";

export const services = createServices({
  BASE_API_MAINNET_URL: browserEnvConfig.NEXT_PUBLIC_BASE_API_MAINNET_URL,
  BASE_PROVIDER_PROXY_URL: browserEnvConfig.NEXT_PUBLIC_PROVIDER_PROXY_URL,
  MANAGED_WALLET_NETWORK_ID: browserEnvConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID,
  apiUrlService: browserApiUrlService
});

/**
 * @deprecated use useServices() instead
 */
export const userHttpService = services.user;
