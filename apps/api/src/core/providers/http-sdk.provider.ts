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

const SERVICES = [BalanceHttpService, AuthzHttpService, BlockHttpService, BidHttpService, LeaseHttpService, ProviderHttpService];

SERVICES.forEach(Service => container.register(Service, { useValue: new Service({ baseURL: apiNodeUrl }) }));

container.register(BalanceHttpService, {
  useFactory: c => new BalanceHttpService({ baseURL: c.resolve(ChainNetworkConfigService).getBaseAPIUrl() })
});
container.register(AuthzHttpService, {
  useFactory: c => new AuthzHttpService({ baseURL: c.resolve(ChainNetworkConfigService).getBaseAPIUrl() })
});
container.register(BlockHttpService, {
  useFactory: c => new BlockHttpService({ baseURL: c.resolve(ChainNetworkConfigService).getBaseAPIUrl() })
});
container.register(BidHttpService, {
  useFactory: c => new BidHttpService({ baseURL: c.resolve(ChainNetworkConfigService).getBaseAPIUrl() })
});
container.register(DeploymentHttpService, {
  useFactory: c => new DeploymentHttpService({ baseURL: c.resolve(ChainNetworkConfigService).getBaseAPIUrl() })
});
container.register(LeaseHttpService, {
  useFactory: c => new LeaseHttpService({ baseURL: c.resolve(ChainNetworkConfigService).getBaseAPIUrl() })
});
container.register(ProviderHttpService, {
  useFactory: c => new ProviderHttpService({ baseURL: c.resolve(ChainNetworkConfigService).getBaseAPIUrl() })
});
container.register(CosmosHttpService, {
  useFactory: c => new CosmosHttpService({ baseURL: c.resolve(ChainNetworkConfigService).getBaseAPIUrl() })
});

container.register(GitHubHttpService, { useValue: new GitHubHttpService({ baseURL: "https://raw.githubusercontent.com" }) });
container.register(DeploymentHttpService, {
  useFactory: c => new DeploymentHttpService(c.resolve(CHAIN_API_HTTP_CLIENT))
});
container.register(CosmosHttpService, {
  useFactory: c => new CosmosHttpService(c.resolve(CHAIN_API_HTTP_CLIENT))
});
container.register(CoinGeckoHttpService, {
  useFactory: () => new CoinGeckoHttpService(createHttpClient({ baseURL: "https://api.coingecko.com" }))
});
container.register(NodeHttpService, {
  useFactory: () => new NodeHttpService(createHttpClient({ baseURL: nodeApiBasePath }))
});
