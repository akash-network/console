import { LoggerService } from "@akashnetwork/logging";

import { ErrorHandlerService } from "./error-handler/error-handler.service";

const logger = new LoggerService({ name: "stats-web" });

export const errorHandler = new ErrorHandlerService(logger);
