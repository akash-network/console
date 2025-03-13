import {
  AuthzHttpService,
  BalanceHttpService,
  BidHttpService,
  BlockHttpService,
  DeploymentHttpService,
  LeaseHttpService,
  ProviderHttpService
} from "@akashnetwork/http-sdk";
import { container } from "tsyringe";

import { apiNodeUrl } from "@src/utils/constants";

const SERVICES = [BalanceHttpService, AuthzHttpService, BlockHttpService, BidHttpService, DeploymentHttpService, LeaseHttpService, ProviderHttpService];

SERVICES.forEach(Service => container.register(Service, { useValue: new Service({ baseURL: apiNodeUrl }) }));
