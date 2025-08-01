import { Log } from "@kubernetes/client-node";
import { container, singleton } from "tsyringe";

import { ErrorHandlerService } from "@src/services/error-handler/error-handler.service";
import { FileDestinationService } from "@src/services/file-destination/file-destination.service";
import { LoggerService } from "@src/services/logger/logger.service";
import type { PodInfo } from "@src/services/pod-discovery/pod-discovery.service";
import { PodLogsCollectorService } from "@src/services/pod-logs-collector/pod-logs-collector.service";
import { Factory } from "@src/types/factory.interface";

/**
 * Factory for creating PodLogsCollectorService instances
 *
 * Creates dedicated PodLogsCollectorService instances for individual pods.
 * Each instance is configured with the specific pod information and file
 * destination service for that pod.
 */
@singleton()
export class PodLogsCollectorFactory implements Factory<PodLogsCollectorService, [PodInfo, FileDestinationService]> {
  /**
   * Creates a new PodLogsCollectorService instance
   *
   * @param podInfo - Information about the pod to collect logs from
   * @param fileDestinationService - File destination service for writing logs
   * @returns A new PodLogsCollectorService instance
   */
  create(podInfo: PodInfo, fileDestinationService: FileDestinationService): PodLogsCollectorService {
    const k8sLogClient = container.resolve(Log);
    const loggerService = container.resolve(LoggerService);
    const errorHandlerService = container.resolve(ErrorHandlerService);

    return new PodLogsCollectorService(podInfo, fileDestinationService, k8sLogClient, errorHandlerService, loggerService);
  }
}
