import "../config/logger.config";

import { useMemo } from "react";
import { LoggerService } from "@akashnetwork/logging";

export const useLogger = (context: string) => {
  return useMemo(() => LoggerService.forContext(context), [context]);
};
