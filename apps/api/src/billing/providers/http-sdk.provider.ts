import { AllowanceHttpService } from "@akashnetwork/http-sdk";
import { container } from "tsyringe";

import { apiNodeUrl } from "@src/utils/constants";

container.register(AllowanceHttpService, { useValue: new AllowanceHttpService({ baseURL: apiNodeUrl }) });
