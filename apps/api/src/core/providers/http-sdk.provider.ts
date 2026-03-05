import type { HttpClient } from "@akashnetwork/http-sdk";
import {
  AuthzHttpService,
  BalanceHttpService,
  BidHttpService,
  BlockHttpService,
  CoinGeckoHttpService,
  CosmosHttpService,
  createHttpClient,
  DeploymentHttpService,
  GitHubHttpService,
  LeaseHttpService,
  NodeHttpService,
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

const SERVICES = [BalanceHttpService, BidHttpService, ProviderHttpService];
SERVICES.forEach(Service =>
  container.register(Service as InjectionToken<unknown>, {
    useFactory: instancePerContainerCachingFactory(c => new Service({ baseURL: c.resolve(CoreConfigService).get("REST_API_NODE_URL") }))
  })
);

const NON_AXIOS_SERVICES: Array<new (httpClient: HttpClient) => unknown> = [
  DeploymentHttpService,
  LeaseHttpService,
  CosmosHttpService,
  AuthzHttpService,
  BlockHttpService
];
NON_AXIOS_SERVICES.forEach(Service =>
  container.register(Service, { useFactory: instancePerContainerCachingFactory(c => new Service(c.resolve(CHAIN_API_HTTP_CLIENT))) })
);

container.register(GitHubHttpService, { useValue: new GitHubHttpService({ baseURL: "https://raw.githubusercontent.com" }) });
container.register(CoinGeckoHttpService, {
  useFactory: instancePerContainerCachingFactory(() => new CoinGeckoHttpService(createHttpClient({ baseURL: "https://api.coingecko.com", adapter: "http" })))
});
container.register(NodeHttpService, {
  useFactory: instancePerContainerCachingFactory(
    c => new NodeHttpService(createHttpClient({ baseURL: c.resolve(CoreConfigService).get("NODE_API_BASE_PATH"), adapter: "http" }))
  )
});
