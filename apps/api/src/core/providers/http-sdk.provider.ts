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
import type { DependencyContainer, InjectionToken } from "tsyringe";
import { container } from "tsyringe";

import { nodeApiBasePath } from "@src/utils/constants";
import { ChainConfigService } from "../../chain/services/chain-config/chain-config.service";

export const CHAIN_API_HTTP_CLIENT: InjectionToken<HttpClient> = Symbol("CHAIN_API_HTTP_CLIENT");

container.register(CHAIN_API_HTTP_CLIENT, {
  useFactory: (c: DependencyContainer) => {
    const chainConfigService = c.resolve(ChainConfigService);
    return createHttpClient({ baseURL: chainConfigService.getBaseAPIUrl() });
  }
});

const SERVICES = [BalanceHttpService, AuthzHttpService, BlockHttpService, BidHttpService, LeaseHttpService, ProviderHttpService] as const;

SERVICES.forEach(Service => {
  container.register(Service, {
    useFactory: (c: DependencyContainer) => {
      const chainConfigService = c.resolve(ChainConfigService);
      return new Service({ baseURL: chainConfigService.getBaseAPIUrl() });
    }
  });
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
