import { Watch } from "@kubernetes/client-node";
import { container, singleton } from "tsyringe";

import { ErrorHandlerService } from "@src/services/error-handler/error-handler.service";
import { FileDestinationService } from "@src/services/file-destination/file-destination.service";
import { K8sEventsCollectorService } from "@src/services/k8s-events-collector/k8s-events-collector.service";
import { LoggerService } from "@src/services/logger/logger.service";
import type { PodInfo } from "@src/services/pod-discovery/pod-discovery.service";
import { Factory } from "@src/types/factory.interface";

@singleton()
export class PodEventsCollectorFactory implements Factory<K8sEventsCollectorService, [PodInfo, FileDestinationService, AbortSignal]> {
  create(podInfo: PodInfo, fileDestinationService: FileDestinationService, signal: AbortSignal): K8sEventsCollectorService {
    const watch = container.resolve(Watch);
    const loggerService = container.resolve(LoggerService);
    const errorHandlerService = container.resolve(ErrorHandlerService);

    return new K8sEventsCollectorService(podInfo, fileDestinationService, watch, loggerService, errorHandlerService, signal);
  }
}
