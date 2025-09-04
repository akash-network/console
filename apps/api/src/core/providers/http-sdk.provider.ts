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
import { container } from "tsyringe";

import { apiNodeUrl, nodeApiBasePath } from "@src/utils/constants";

export const CHAIN_API_HTTP_CLIENT: InjectionToken<HttpClient> = Symbol("CHAIN_API_HTTP_CLIENT");

container.register(CHAIN_API_HTTP_CLIENT, {
  useFactory: () => createHttpClient({ baseURL: apiNodeUrl })
});

const SERVICES = [BalanceHttpService, AuthzHttpService, BlockHttpService, BidHttpService, ProviderHttpService];
SERVICES.forEach(Service => container.register(Service, { useValue: new Service({ baseURL: apiNodeUrl }) }));

const NON_AXIOS_SERVICES: Array<new (httpClient: HttpClient) => unknown> = [DeploymentHttpService, LeaseHttpService, CosmosHttpService];
NON_AXIOS_SERVICES.forEach(Service => container.register(Service, { useFactory: c => new Service(c.resolve(CHAIN_API_HTTP_CLIENT)) }));

container.register(GitHubHttpService, { useValue: new GitHubHttpService({ baseURL: "https://raw.githubusercontent.com" }) });
container.register(CoinGeckoHttpService, {
  useFactory: () => new CoinGeckoHttpService(createHttpClient({ baseURL: "https://api.coingecko.com" }))
});
container.register(NodeHttpService, {
  useFactory: () => new NodeHttpService(createHttpClient({ baseURL: nodeApiBasePath }))
});
