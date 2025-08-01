import { container, singleton } from "tsyringe";

import { ConfigService } from "@src/services/config/config.service";
import { FileDestinationService } from "@src/services/file-destination/file-destination.service";
import { LoggerService } from "@src/services/logger/logger.service";
import type { PodInfo } from "@src/services/pod-discovery/pod-discovery.service";
import { Factory } from "../../types/factory.interface";

/**
 * Factory for creating FileDestinationService instances
 *
 * Creates dedicated FileDestinationService instances for individual pods.
 * Each instance is configured with the specific pod information and handles
 * log file management for that pod.
 */
@singleton()
export class FileDestinationFactory implements Factory<FileDestinationService, [PodInfo]> {
  /**
   * Creates a new FileDestinationService instance
   *
   * @param podInfo - Information about the pod to manage logs for
   * @returns A new FileDestinationService instance
   */
  create(podInfo: PodInfo): FileDestinationService {
    const loggerService = container.resolve(LoggerService);
    const configService = container.resolve(ConfigService);

    return new FileDestinationService(loggerService, configService, podInfo);
  }
}
