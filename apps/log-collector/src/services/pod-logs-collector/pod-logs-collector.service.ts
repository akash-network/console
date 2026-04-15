import { Log as K8sLog } from "@kubernetes/client-node";
import { LogOptions } from "@kubernetes/client-node/dist/log";
import { PassThrough } from "stream";
import { setTimeout as delay } from "timers/promises";
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
 * - AbortSignal support for graceful teardown when a pod disappears
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
   * Backoff between reopening the K8s log stream after it closes.
   * Keeps the loop from hammering the API on persistent errors.
   */
  private readonly LOG_STREAM_RECONNECT_BACKOFF_MS = 500;

  /**
   * Creates a new PodLogsCollectorService instance
   *
   * @param podInfo - Information about the pod to collect logs from
   * @param fileDestination - Service for writing logs to files
   * @param k8sLogClient - Kubernetes client for log streaming
   * @param errorHandlerService - Service for aggregating errors from concurrent operations
   * @param loggerService - Service for logging application events
   * @param signal - Optional AbortSignal for graceful teardown when a pod disappears
   */
  constructor(
    private readonly podInfo: PodInfo,
    private readonly fileDestination: FileDestinationService,
    private readonly k8sLogClient: K8sLog,
    private readonly errorHandlerService: ErrorHandlerService,
    private readonly loggerService: LoggerService,
    private readonly signal?: AbortSignal
  ) {
    this.loggerService.setContext(PodLogsCollectorService.name);
  }

  /**
   * Starts log collection for all containers in the pod
   *
   * This method:
   * 1. Checks if the pod has any containers to collect from
   * 2. Starts concurrent log collection for all containers
   * 3. Uses timestamp-based resumption to avoid duplicate logs
   *
   * @returns Promise that resolves when all log collection has been initiated
   * @throws Error if file destination operations fail
   * @throws AggregateError if any container fails to start log collection
   */
  async collectPodLogs(): Promise<void> {
    if (this.signal?.aborted) return;

    if (this.podInfo.containerNames.length === 0) {
      this.loggerService.warn({
        event: "POD_LOGS_NO_CONTAINERS",
        podName: this.podInfo.podName,
        namespace: this.podInfo.namespace
      });
      return;
    }

    try {
      await this.startLogCollectionForAllContainers(this.podInfo.containerNames);
    } catch (error) {
      if (this.errorHandlerService.isForbidden(error)) {
        this.loggerService.warn({
          event: "POD_LOGS_COLLECTION_FORBIDDEN",
          podName: this.podInfo.podName,
          namespace: this.podInfo.namespace,
          message: 'Logs collection is forbidden. Ensure the SDL includes permissions: { read: ["logs"] }'
        });
        return;
      }
      throw error;
    }
  }

  /**
   * Starts concurrent log collection for all containers in the pod
   *
   * Creates dedicated log streams for each container and starts concurrent collection.
   * Uses error aggregation to handle failures from individual containers gracefully.
   *
   * @param containerNames - Array of container names to collect logs from
   * @returns Promise that resolves when all log collection has been initiated
   * @throws AggregateError if any container fails to start log collection
   */
  private async startLogCollectionForAllContainers(containerNames: string[]): Promise<void> {
    const collectionPromises = containerNames.map(containerName => this.collectContainerLogs(containerName));
    await this.errorHandlerService.aggregateConcurrentResults(collectionPromises, "container log collection");
  }

  /**
   * Collects logs for a single container until the pod-level signal is aborted.
   *
   * Acquires the stable write stream once, then repeatedly opens fresh K8s log
   * streams and pipes them into it. A close on the K8s side (apiserver restart,
   * LB timeout, network blip, container restart) triggers a reconnect; only
   * an aborted signal stops the loop.
   *
   * @param containerName - Name of the container to collect logs from
   * @throws Error on 403 Forbidden — bubbles up to stop pod-level collection
   */
  private async collectContainerLogs(containerName: string): Promise<void> {
    const writeStream = await this.fileDestination.createWriteStream();
    this.loggerService.info({
      event: "CONTAINER_LOG_COLLECTION_STARTED",
      podName: this.podInfo.podName,
      namespace: this.podInfo.namespace,
      containerName
    });

    try {
      while (!this.signal?.aborted) {
        try {
          await this.streamContainerLogsOnce(containerName, writeStream);
        } catch (error) {
          if (this.errorHandlerService.isForbidden(error)) throw error;
          this.loggerService.warn({
            event: "CONTAINER_LOG_STREAM_ERROR",
            podName: this.podInfo.podName,
            namespace: this.podInfo.namespace,
            containerName,
            error
          });
        }

        if (this.signal?.aborted) break;
        await delay(this.LOG_STREAM_RECONNECT_BACKOFF_MS, null, { signal: this.signal }).catch(() => undefined);
      }
    } finally {
      writeStream.end();
    }
  }

  /**
   * Runs one stream session: sets up the K8s → file pipe, waits for it to
   * end (close or error), unwinds on failure. Resolves on clean close.
   */
  private async streamContainerLogsOnce(containerName: string, writeStream: NodeJS.WritableStream): Promise<void> {
    const lastLogLines = await this.fileDestination.getLastLogLines();
    const logStream = new PassThrough();
    await Promise.all([this.startKubernetesLogStream(containerName, logStream, lastLogLines[0]?.timestamp), this.write(logStream, writeStream, lastLogLines)]);
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
   * - Resolve on stream close or reject on stream errors
   *
   * Does NOT end the provided `writeStream` — the caller owns its lifetime and
   * reuses it across reconnects.
   *
   * @param logStream - The PassThrough stream to configure for log processing
   * @param writeStream - Stable destination stream (owned by the caller)
   * @param lastLogLines - Previously written lines used to deduplicate replays at the start of the stream
   * @returns Promise that resolves on stream close or rejects on stream errors
   */
  private write(logStream: PassThrough, writeStream: NodeJS.WritableStream, lastLogLines: { line: string; timestamp?: number | null }[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let remainingBuffer: Buffer<ArrayBufferLike> = Buffer.alloc(0);
      const deduplicator = this.createDeduplicator(lastLogLines);

      const onWriteStreamError = (error: Error) => {
        this.loggerService.error({
          event: "WRITE_STREAM_ERROR",
          error,
          podName: this.podInfo.podName,
          namespace: this.podInfo.namespace
        });
        reject(error);
        logStream.destroy();
      };
      writeStream.on("error", onWriteStreamError);

      logStream.on("error", error => {
        this.loggerService.error({
          event: "LOG_STREAM_ERROR",
          error,
          podName: this.podInfo.podName,
          namespace: this.podInfo.namespace
        });
        writeStream.off("error", onWriteStreamError);
        reject(error);
      });

      logStream.on("close", () => {
        this.loggerService.info({
          event: "LOG_STREAM_CLOSED",
          podName: this.podInfo.podName,
          namespace: this.podInfo.namespace
        });
        writeStream.off("error", onWriteStreamError);
        resolve();
      });

      logStream.on("data", (chunk: Buffer) => {
        const { lines, remaining } = this.splitChunkIntoLines(remainingBuffer, chunk);
        remainingBuffer = remaining;

        const outputLines = deduplicator(lines);

        if (outputLines.length > 0) {
          const outputContent = outputLines.join("\n") + "\n";
          const canContinue = writeStream.write(outputContent);
          if (!canContinue) {
            logStream.pause();
            writeStream.once("drain", () => logStream.resume());
          }
        }
      });
    });
  }

  /**
   * Splits a buffer chunk into complete lines, carrying over incomplete trailing lines.
   *
   * @param remainingBuffer - Leftover bytes from the previous chunk
   * @param chunk - The new data chunk to process
   * @returns Object with complete lines and any remaining incomplete line bytes
   */
  private splitChunkIntoLines(remainingBuffer: Buffer<ArrayBufferLike>, chunk: Buffer): { lines: string[]; remaining: Buffer<ArrayBufferLike> } {
    const combinedBuffer = Buffer.concat([remainingBuffer, chunk]);
    const parts = combinedBuffer.toString().split("\n");
    const NEWLINE_CHAR_CODE = 10;
    const isLastLineComplete = combinedBuffer[combinedBuffer.length - 1] === NEWLINE_CHAR_CODE;

    return {
      lines: isLastLineComplete ? parts : parts.slice(0, -1),
      remaining: isLastLineComplete ? Buffer.alloc(0) : Buffer.from(parts[parts.length - 1])
    };
  }

  /**
   * Creates a stateful deduplicator function that filters out duplicate log lines.
   *
   * Compares incoming lines against the last log lines from the file destination
   * during the first chunk window (300ms), then stops deduplication to avoid
   * false positives on legitimately repeated log lines.
   *
   * @param lastLogLines - Previously written log lines to compare against
   * @returns A function that accepts lines and returns only non-duplicate lines
   */
  private createDeduplicator(lastLogLines: { line: string; timestamp?: number | null }[]): (lines: string[]) => string[] {
    let isFirstChunk = true;
    let firstChunkTimeout: NodeJS.Timeout | undefined;

    return (lines: string[]) => {
      const outputLines: string[] = [];

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }

        if (isFirstChunk && lastLogLines.length > 0 && lastLogLines.some(lastLogLine => lastLogLine.line === line)) {
          this.loggerService.info({
            event: "LOG_LINE_DUPLICATE_SKIPPED",
            podName: this.podInfo.podName,
            namespace: this.podInfo.namespace,
            duplicateLine: line.substring(0, 100) + "..."
          });
          continue;
        } else {
          if (!firstChunkTimeout) {
            firstChunkTimeout = setTimeout(() => {
              isFirstChunk = false;
            }, 300);
          }
        }

        outputLines.push(line);
      }

      return outputLines;
    };
  }

  /**
   * Starts Kubernetes log streaming for a specific container
   *
   * Configures log stream options based on whether we're resuming from a timestamp
   * and initiates the Kubernetes log stream for the specified container.
   * Hooks into the AbortSignal to tear down the k8s stream and logStream when
   * the pod disappears.
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

    const k8sAbortRef: { current?: AbortController } = {};

    if (this.signal) {
      const onAbort = () => {
        k8sAbortRef.current?.abort();
        logStream.destroy();
      };
      this.signal.addEventListener("abort", onAbort, { once: true });
      logStream.once("close", () => this.signal?.removeEventListener("abort", onAbort));

      if (this.signal.aborted) {
        logStream.destroy();
        return;
      }
    }

    try {
      k8sAbortRef.current = await this.k8sLogClient.log(this.podInfo.namespace, this.podInfo.podName, containerName, logStream, logStreamOptions);
    } catch (error) {
      logStream.destroy();
      throw error;
    }

    if (this.signal?.aborted) {
      k8sAbortRef.current?.abort();
      logStream.destroy();
    }

    this.loggerService.info({
      event: "K8S_LOG_STREAM_ESTABLISHED",
      podName: this.podInfo.podName,
      namespace: this.podInfo.namespace,
      containerName,
      aborted: k8sAbortRef.current?.signal?.aborted
    });
  }
}
