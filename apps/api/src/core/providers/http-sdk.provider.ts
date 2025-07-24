import {
  AuthzHttpService,
  BalanceHttpService,
  BidHttpService,
  BlockHttpService,
  CoinGeckoHttpService,
  CosmosHttpService,
  DeploymentHttpService,
  GitHubHttpService,
  LeaseHttpService,
  NodeHttpService,
  ProviderHttpService
} from "@akashnetwork/http-sdk";
import axios from "axios";
import { container } from "tsyringe";

import { apiNodeUrl, nodeApiBasePath } from "@src/utils/constants";

const SERVICES = [
  BalanceHttpService,
  AuthzHttpService,
  BlockHttpService,
  BidHttpService,
  DeploymentHttpService,
  LeaseHttpService,
  ProviderHttpService,
  CosmosHttpService
];

SERVICES.forEach(Service => container.register(Service, { useValue: new Service(axios.create({ baseURL: apiNodeUrl })) }));

container.register(GitHubHttpService, { useValue: new GitHubHttpService(axios.create({ baseURL: "https://raw.githubusercontent.com" })) });
container.register(CoinGeckoHttpService, { useValue: new CoinGeckoHttpService(axios.create({ baseURL: "https://api.coingecko.com" })) });
container.register(NodeHttpService, { useValue: new NodeHttpService(axios.create({ baseURL: nodeApiBasePath })) });
