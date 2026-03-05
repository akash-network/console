import { singleton } from "tsyringe";

import { FileDestinationFactory } from "@src/factories/file-destination/file-destination.factory";
import { PodLogsCollectorFactory } from "@src/factories/pod-logs-collector/pod-logs-collector.factory";
import { ErrorHandlerService } from "@src/services/error-handler/error-handler.service";
import { LoggerService } from "@src/services/logger/logger.service";
import { PodDiscoveryService, PodInfo } from "@src/services/pod-discovery/pod-discovery.service";

@singleton()
export class K8sCollectorService {
  constructor(
    private readonly podDiscoveryService: PodDiscoveryService,
    private readonly podLogsCollectorFactory: PodLogsCollectorFactory,
    private readonly fileDestinationFactory: FileDestinationFactory,
    private readonly loggerService: LoggerService,
    private readonly errorHandlerService: ErrorHandlerService
  ) {
    this.loggerService.setContext(K8sCollectorService.name);
  }

  async start(): Promise<void> {
    try {
      await this.podDiscoveryService.watchPods((podInfo, signal) => {
        this.startCollectionForPod(podInfo, signal);
      });
    } catch (error) {
      if (this.errorHandlerService.isForbidden(error)) {
        this.loggerService.warn({
          event: "POD_DISCOVERY_FORBIDDEN",
          message: 'Pod discovery is forbidden. Ensure the SDL includes permissions: { read: ["logs", "events"] }'
        });
        return;
      }
      throw error;
    }
  }

  private startCollectionForPod(podInfo: PodInfo, signal: AbortSignal): void {
    try {
      const fileDestination = this.fileDestinationFactory.create(podInfo);
      const podLogsCollector = this.podLogsCollectorFactory.create(podInfo, fileDestination, signal);

      podLogsCollector.collectPodLogs().catch(error => {
        this.loggerService.error({
          event: "POD_LOG_COLLECTION_FAILED",
          error,
          podName: podInfo.podName,
          namespace: podInfo.namespace
        });
      });
    } catch (error) {
      this.loggerService.error({
        event: "POD_LOG_COLLECTION_FAILED",
        error,
        podName: podInfo.podName,
        namespace: podInfo.namespace
      });
    }
  }
}
