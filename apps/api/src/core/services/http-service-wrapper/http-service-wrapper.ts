import {
  AuthzHttpService,
  BalanceHttpService,
  BidHttpService,
  BlockHttpService,
  CosmosHttpService,
  DeploymentHttpService,
  LeaseHttpService,
  ProviderHttpService
} from "@akashnetwork/http-sdk";
import { singleton } from "tsyringe";

import { ChainConfigService } from "../chain-config/chain-config.service";

@singleton()
export class BalanceHttpServiceWrapper extends BalanceHttpService {
  constructor(chainConfigService: ChainConfigService) {
    super({ baseURL: chainConfigService.getBaseAPIUrl() });
  }
}

@singleton()
export class AuthzHttpServiceWrapper extends AuthzHttpService {
  constructor(chainConfigService: ChainConfigService) {
    super({ baseURL: chainConfigService.getBaseAPIUrl() });
  }
}

@singleton()
export class BlockHttpServiceWrapper extends BlockHttpService {
  constructor(chainConfigService: ChainConfigService) {
    super({ baseURL: chainConfigService.getBaseAPIUrl() });
  }
}

@singleton()
export class BidHttpServiceWrapper extends BidHttpService {
  constructor(chainConfigService: ChainConfigService) {
    super({ baseURL: chainConfigService.getBaseAPIUrl() });
  }
}

@singleton()
export class DeploymentHttpServiceWrapper extends DeploymentHttpService {
  constructor(chainConfigService: ChainConfigService) {
    super({ baseURL: chainConfigService.getBaseAPIUrl() });
  }
}

@singleton()
export class LeaseHttpServiceWrapper extends LeaseHttpService {
  constructor(chainConfigService: ChainConfigService) {
    super({ baseURL: chainConfigService.getBaseAPIUrl() });
  }
}

@singleton()
export class ProviderHttpServiceWrapper extends ProviderHttpService {
  constructor(chainConfigService: ChainConfigService) {
    super({ baseURL: chainConfigService.getBaseAPIUrl() });
  }
}

@singleton()
export class CosmosHttpServiceWrapper extends CosmosHttpService {
  constructor(chainConfigService: ChainConfigService) {
    super({ baseURL: chainConfigService.getBaseAPIUrl() });
  }
}
