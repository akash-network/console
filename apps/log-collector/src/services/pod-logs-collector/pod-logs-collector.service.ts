import { Log as K8sLog } from "@kubernetes/client-node";
import { LogOptions } from "@kubernetes/client-node/dist/log";
import { PassThrough } from "stream";
import { singleton } from "tsyringe";

import { ErrorHandlerService } from "@src/services/error-handler/error-handler.service";
import { FileDestinationService } from "@src/services/file-destination/file-destination.service";
import { LoggerService } from "@src/services/logger/logger.service";
import type { PodInfo } from "@src/services/pod-discovery/pod-discovery.service";

/**
 * Collects logs from all containers in a Kubernetes pod
 *
 * This service handles the collection of logs from multiple containers within a single pod.
 * It provides features such as:
 * - Concurrent log collection from multiple containers
 * - Timestamp-based log resumption to avoid duplicates using last log lines with same timestamp
 * - Stream processing with duplicate line detection against multiple last log lines
 * - Error aggregation for robust error handling
 */
@singleton()
export class PodLogsCollectorService {
  /**
   * Default options for Kubernetes log streaming
   */
  private readonly DEFAULT_LOG_STREAM_OPTIONS: LogOptions = {
    follow: true,
    tailLines: 100,
    pretty: false,
    timestamps: true
  };

  /**
   * Creates a new PodLogsCollectorService instance
   *
   * @param podInfo - Information about the pod to collect logs from
   * @param fileDestination - Service for writing logs to files
   * @param k8sLogClient - Kubernetes client for log streaming
   * @param errorHandlerService - Service for aggregating errors from concurrent operations
   * @param loggerService - Service for logging application events
   */
  constructor(
    private readonly podInfo: PodInfo,
    private readonly fileDestination: FileDestinationService,
    private readonly k8sLogClient: K8sLog,
    private readonly errorHandlerService: ErrorHandlerService,
    private readonly loggerService: LoggerService
  ) {
    this.loggerService.setContext(PodLogsCollectorService.name);
  }

  /**
   * Starts log collection for all containers in the pod
   *
   * This method:
   * 1. Retrieves the last log lines with the same timestamp to determine resumption point
   * 2. Checks if the pod has any containers to collect from
   * 3. Starts concurrent log collection for all containers
   * 4. Uses timestamp-based resumption to avoid duplicate logs
   *
   * @returns Promise that resolves when all log collection has been initiated
   * @throws Error if file destination operations fail
   * @throws AggregateError if any container fails to start log collection
   */
  async collectPodLogs(): Promise<void> {
    const logLine = await this.fileDestination.getLastLogLines();

    if (this.podInfo.containerNames.length === 0) {
      this.loggerService.warn({
        podName: this.podInfo.podName,
        namespace: this.podInfo.namespace,
        message: "No containers found in pod"
      });
      return;
    }

    await this.startLogCollectionForAllContainers(this.podInfo.containerNames, logLine[0]?.timestamp);
  }

  /**
   * Starts concurrent log collection for all containers in the pod
   *
   * Creates dedicated log streams for each container and starts concurrent collection.
   * Uses error aggregation to handle failures from individual containers gracefully.
   *
   * @param containerNames - Array of container names to collect logs from
   * @param lastTimestamp - Timestamp to resume from, prevents duplicate log collection
   * @returns Promise that resolves when all log collection has been initiated
   * @throws AggregateError if any container fails to start log collection
   */
  private async startLogCollectionForAllContainers(containerNames: string[], lastTimestamp?: number | null): Promise<void> {
    const collectionPromises = containerNames.map(async containerName => {
      const logStream = new PassThrough();
      const writePromise = this.write(logStream);

      this.loggerService.info({
        podName: this.podInfo.podName,
        namespace: this.podInfo.namespace,
        containerName,
        message: "Starting log collection for container"
      });

      const k8sPromise = this.startKubernetesLogStream(containerName, logStream, lastTimestamp);

      await Promise.all([writePromise, k8sPromise]);
    });

    await this.errorHandlerService.aggregateConcurrentResults(collectionPromises, "container log collection");
  }

  /**
   * Sets up log processing and writing to the file destination
   *
   * Configures the log stream to:
   * - Process incoming log data in chunks
   * - Handle incomplete lines across chunk boundaries
   * - Filter out empty lines
   * - Detect and skip duplicate log lines by comparing against all last log lines with same timestamp
   * - Write processed logs to the stable file destination
   * - Return a promise that rejects if there are any stream errors
   *
   * @param logStream - The PassThrough stream to configure for log processing
   * @returns Promise that stays pending and rejects on stream errors
   */
  private write(logStream: PassThrough): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      (async () => {
        try {
          const writeStream = await this.fileDestination.createWriteStream();
          const lastLogLines = await this.fileDestination.getLastLogLines();

          let isFirstChunk = true;
          let remainingBuffer = Buffer.alloc(0);

          writeStream.on("error", error => {
            this.loggerService.error({
              error,
              message: "Write stream error during log collection",
              podName: this.podInfo.podName,
              namespace: this.podInfo.namespace
            });
            reject(error);
          });

          logStream.on("error", error => {
            this.loggerService.error({
              error,
              message: "Log stream error during log collection",
              podName: this.podInfo.podName,
              namespace: this.podInfo.namespace
            });
            reject(error);
          });

          logStream.on("data", (chunk: Buffer) => {
            const combinedBuffer = Buffer.concat([remainingBuffer, chunk]);
            const lines = combinedBuffer.toString().split("\n");

            const isLastLineComplete = combinedBuffer[combinedBuffer.length - 1] === 10;
            const linesToProcess = isLastLineComplete ? lines : lines.slice(0, -1);
            remainingBuffer = isLastLineComplete ? Buffer.alloc(0) : Buffer.from(lines[lines.length - 1]);

            const outputLines: string[] = [];

            for (let i = 0; i < linesToProcess.length; i++) {
              const line = linesToProcess[i];

              if (!line.trim()) {
                continue;
              }

              if (isFirstChunk && lastLogLines.length > 0 && lastLogLines.some(lastLogLine => lastLogLine.line === line)) {
                this.loggerService.info({
                  podName: this.podInfo.podName,
                  namespace: this.podInfo.namespace,
                  message: "Skipping duplicate log line",
                  duplicateLine: line.substring(0, 100) + "..."
                });
                continue;
              } else {
                setTimeout(() => {
                  isFirstChunk = false;
                }, 1000);
              }

              outputLines.push(line);
            }

            if (outputLines.length > 0) {
              const outputContent = outputLines.join("\n") + "\n";
              const canContinue = writeStream.write(outputContent);
              if (!canContinue) {
                logStream.pause();
                writeStream.once("drain", () => logStream.resume());
              }
            }
          });
        } catch (error) {
          reject(error);
        }
      })();
    });
  }

  /**
   * Starts Kubernetes log streaming for a specific container
   *
   * Configures log stream options based on whether we're resuming from a timestamp
   * and initiates the Kubernetes log stream for the specified container.
   * Note: Kubernetes sinceTime parameter ignores milliseconds, so timestamp-based
   * resumption may include some duplicate logs that need to be filtered out.
   *
   * @param containerName - Name of the container to stream logs from
   * @param logStream - PassThrough stream to receive the log data
   * @param lastTimestamp - Timestamp to resume from, if provided tailLines is set to 0
   * @returns Promise that resolves when the log stream has been initiated
   */
  private async startKubernetesLogStream(containerName: string, logStream: PassThrough, lastTimestamp?: number | null): Promise<void> {
    const logStreamOptions: LogOptions = {
      ...this.DEFAULT_LOG_STREAM_OPTIONS,
      sinceTime: lastTimestamp ? new Date(lastTimestamp).toISOString() : undefined,
      tailLines: lastTimestamp ? 0 : this.DEFAULT_LOG_STREAM_OPTIONS.tailLines,
      timestamps: true
    };

    await this.k8sLogClient.log(this.podInfo.namespace, this.podInfo.podName, containerName, logStream, logStreamOptions);
  }
}
