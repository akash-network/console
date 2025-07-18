import "reflect-metadata";
import "@akashnetwork/env-loader";
import "./providers/k8s-client.provider";
import "./providers/datadog-client.provider";

import { container } from "tsyringe";

import { LOG_DESTINATION } from "@src/providers/log-destination.provider";
import { K8sLogCollectorService } from "@src/services/k8s-log-collector/k8s-log-collector.service";
import type { LogDestinationService } from "@src/types/log-destination.interface";

const logCollectorService = container.resolve(K8sLogCollectorService);
const logDestinationService = container.resolve<LogDestinationService>(LOG_DESTINATION);

logCollectorService.collectLogs(logDestinationService).catch(error => {
  console.log("DEBUG error", error);
});
