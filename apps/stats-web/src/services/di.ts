import { ErrorHandlerService } from "./error-handler/error-handler.service";

import { createLogger } from "@/lib/createLogger/createLogger";

export const logger = createLogger({ name: "stats-web" });

export const errorHandler = new ErrorHandlerService(logger);
