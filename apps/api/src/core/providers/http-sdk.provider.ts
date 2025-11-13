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

import { apiNodeUrl, nodeApiBasePath } from "@src/utils/constants";

export const CHAIN_API_HTTP_CLIENT: InjectionToken<HttpClient> = Symbol("CHAIN_API_HTTP_CLIENT");

container.register(CHAIN_API_HTTP_CLIENT, {
  useFactory: instancePerContainerCachingFactory(() => createHttpClient({ baseURL: apiNodeUrl }))
});

const SERVICES = [BalanceHttpService, BlockHttpService, BidHttpService, ProviderHttpService];
SERVICES.forEach(Service => container.register(Service, { useValue: new Service({ baseURL: apiNodeUrl }) }));

const NON_AXIOS_SERVICES: Array<new (httpClient: HttpClient) => unknown> = [DeploymentHttpService, LeaseHttpService, CosmosHttpService, AuthzHttpService];
NON_AXIOS_SERVICES.forEach(Service =>
  container.register(Service, { useFactory: instancePerContainerCachingFactory(c => new Service(c.resolve(CHAIN_API_HTTP_CLIENT))) })
);

container.register(GitHubHttpService, { useValue: new GitHubHttpService({ baseURL: "https://raw.githubusercontent.com" }) });
container.register(CoinGeckoHttpService, {
  useFactory: instancePerContainerCachingFactory(() => new CoinGeckoHttpService(createHttpClient({ baseURL: "https://api.coingecko.com" })))
});
container.register(NodeHttpService, {
  useFactory: instancePerContainerCachingFactory(() => new NodeHttpService(createHttpClient({ baseURL: nodeApiBasePath })))
});
