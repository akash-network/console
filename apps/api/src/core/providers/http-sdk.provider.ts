import type { HttpClient } from "@akashnetwork/http-sdk";
import {
  AuthzHttpService,
  BalanceHttpService,
  BidHttpService,
  BlockHttpService,
  BmeHttpService,
  CosmosHttpService,
  createHttpClient,
  DeploymentHttpService,
  GitHubHttpService,
  LeaseHttpService,
  ProviderHttpService
} from "@akashnetwork/http-sdk";
import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { CoreConfigService } from "../services/core-config/core-config.service";

export const CHAIN_API_HTTP_CLIENT: InjectionToken<HttpClient> = Symbol("CHAIN_API_HTTP_CLIENT");

container.register(CHAIN_API_HTTP_CLIENT, {
  useFactory: instancePerContainerCachingFactory(c =>
    createHttpClient({
      baseURL: c.resolve(CoreConfigService).get("REST_API_NODE_URL"),
      adapter: "http"
    })
  )
});

const NON_AXIOS_SERVICES: Array<new (httpClient: HttpClient) => unknown> = [
  DeploymentHttpService,
  LeaseHttpService,
  CosmosHttpService,
  AuthzHttpService,
  BlockHttpService,
  BmeHttpService,
  BidHttpService,
  BalanceHttpService,
  ProviderHttpService
];
NON_AXIOS_SERVICES.forEach(Service =>
  container.register(Service, { useFactory: instancePerContainerCachingFactory(c => new Service(c.resolve(CHAIN_API_HTTP_CLIENT))) })
);

container.register(GitHubHttpService, { useValue: new GitHubHttpService({ baseURL: "https://raw.githubusercontent.com" }) });
