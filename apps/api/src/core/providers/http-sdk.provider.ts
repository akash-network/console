import { AuthzHttpService, BalanceHttpService, BlockHttpService } from "@akashnetwork/http-sdk";
import { container } from "tsyringe";

import { apiNodeUrl } from "@src/utils/constants";

const SERVICES = [BalanceHttpService, AuthzHttpService, BlockHttpService];

SERVICES.forEach(Service => container.register(Service, { useValue: new Service({ baseURL: apiNodeUrl }) }));
