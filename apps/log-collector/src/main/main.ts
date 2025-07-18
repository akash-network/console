import "reflect-metadata";
import "@akashnetwork/env-loader";
import "../providers/process-env.provider";
import "../providers/k8s-client.provider";
import "../providers/datadog-client.provider";

import { container } from "tsyringe";

import { LOG_DESTINATION } from "@src/providers/log-destination.provider";
import { K8sLogCollectorService } from "@src/services/k8s-log-collector/k8s-log-collector.service";
import { LoggerService } from "@src/services/logger/logger.service";
import type { LogDestinationService } from "@src/types/log-destination.interface";

export const bootstrap = async (c = container) => {
  const loggerService = c.resolve(LoggerService);
  loggerService.setContext("INIT");

  const logCollectorService = c.resolve(K8sLogCollectorService);
  const logDestinationService = c.resolve<LogDestinationService>(LOG_DESTINATION);

  await logCollectorService.collectLogs(logDestinationService).catch(error => {
    loggerService.error({ error });
  });
};
