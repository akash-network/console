import { singleton } from "tsyringe";

import { FileDestinationFactory } from "@src/factories/file-destination/file-destination.factory";
import { PodLogsCollectorFactory } from "@src/factories/pod-logs-collector/pod-logs-collector.factory";
import { ErrorHandlerService } from "@src/services/error-handler/error-handler.service";
import { LoggerService } from "@src/services/logger/logger.service";
import { PodDiscoveryService, PodInfo } from "@src/services/pod-discovery/pod-discovery.service";

/**
 * Orchestrates log collection from Kubernetes pods in the current namespace
 *
 * This service coordinates the discovery of pods and the collection of their logs.
 * It uses factory patterns to create dedicated instances of log collectors and file
 * destinations for each pod, ensuring proper separation of concerns and resource management.
 */
@singleton()
export class K8sLogCollectorService {
  constructor(
    private readonly podDiscoveryService: PodDiscoveryService,
    private readonly podLogsCollectorFactory: PodLogsCollectorFactory,
    private readonly fileDestinationFactory: FileDestinationFactory,
    private readonly loggerService: LoggerService,
    private readonly errorHandlerService: ErrorHandlerService
  ) {
    this.loggerService.setContext(K8sLogCollectorService.name);
  }

  /**
   * Starts the log collection process for all pods in the current namespace
   *
   * This method:
   * 1. Discovers all pods in the current namespace
   * 2. Creates dedicated log collectors and file destinations for each pod
   * 3. Starts concurrent log collection for all pods
   *
   * @returns Promise that resolves when all log collection has started successfully
   * @throws Error if pod discovery fails
   * @throws AggregateError if any pod fails to start log collection
   */
  async start(): Promise<void> {
    const pods = await this.podDiscoveryService.discoverPodsInNamespace();

    if (pods.length === 0) {
      this.loggerService.warn({ message: "No pods found to collect logs from. Exiting." });
      return;
    }

    await this.startLogCollectionForAllPods(pods);
  }

  /**
   * Starts log collection for multiple pods concurrently
   *
   * Creates dedicated instances of FileDestinationService and PodLogsCollectorService
   * for each pod using factory patterns, then starts concurrent log collection.
   *
   * @param pods - Array of pod information to collect logs from
   * @returns Promise that resolves when all log collection has been initiated
   * @throws AggregateError if any pod fails to start log collection
   */
  private async startLogCollectionForAllPods(pods: PodInfo[]): Promise<void> {
    const collectionPromises = pods.map(pod => {
      const fileDestination = this.fileDestinationFactory.create(pod);
      const podLogsCollector = this.podLogsCollectorFactory.create(pod, fileDestination);

      return podLogsCollector.collectPodLogs();
    });

    await this.errorHandlerService.aggregateConcurrentResults(collectionPromises, { totalPods: pods.length }, "pod log collection");
  }
}
