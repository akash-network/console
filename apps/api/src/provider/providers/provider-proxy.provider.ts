import { createHttpClient, type HttpClient } from "@akashnetwork/http-sdk";
import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";

export const PROVIDER_PROXY_HTTP_CLIENT: InjectionToken<HttpClient> = Symbol("PROVIDER_PROXY_HTTP_CLIENT");

container.register(PROVIDER_PROXY_HTTP_CLIENT, {
  useFactory: instancePerContainerCachingFactory(c => {
    const configService = c.resolve(DeploymentConfigService);
    return createHttpClient({
      baseURL: configService.get("PROVIDER_PROXY_URL")
    });
  })
});
