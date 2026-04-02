import type { CoreV1Event } from "@kubernetes/client-node";
import type { Watch } from "@kubernetes/client-node";

import { AsyncChannel } from "@src/lib/async-channel/async-channel";
import type { ErrorHandlerService } from "@src/services/error-handler/error-handler.service";
import type { FileDestinationService } from "@src/services/file-destination/file-destination.service";
import type { LoggerService } from "@src/services/logger/logger.service";
import type { PodInfo } from "@src/services/pod-discovery/pod-discovery.service";

export class K8sEventsCollectorService {
  constructor(
    private readonly podInfo: PodInfo,
    private readonly fileDestination: FileDestinationService,
    private readonly watch: Watch,
    private readonly loggerService: LoggerService,
    private readonly errorHandlerService: ErrorHandlerService,
    private readonly signal: AbortSignal
  ) {
    this.loggerService.setContext(K8sEventsCollectorService.name);
  }

  async collectPodEvents(): Promise<void> {
    const writeStream = await this.fileDestination.createWriteStream();
    let resourceVersion: string | undefined;

    while (!this.signal.aborted) {
      try {
        resourceVersion = await this.watchEvents(writeStream, resourceVersion);
      } catch (error) {
        if (this.signal.aborted) return;

        if (this.errorHandlerService.isForbidden(error)) {
          this.loggerService.warn({
            event: "POD_EVENTS_WATCH_FORBIDDEN",
            podName: this.podInfo.podName,
            namespace: this.podInfo.namespace
          });
          return;
        }

        throw error;
      }
    }
  }

  private async watchEvents(writeStream: NodeJS.WritableStream, resourceVersion?: string): Promise<string | undefined> {
    const path = `/api/v1/namespaces/${this.podInfo.namespace}/events`;
    const fieldSelector = `involvedObject.name=${this.podInfo.podName}`;
    const channel = new AsyncChannel<{ phase: string; event: CoreV1Event }>();

    let doneError: unknown;
    let currentResourceVersion = resourceVersion;

    await this.watch
      .watch(
        path,
        { fieldSelector, resourceVersion },
        (phase: string, apiObj: CoreV1Event) => {
          if (apiObj.metadata?.resourceVersion) {
            currentResourceVersion = apiObj.metadata.resourceVersion;
          }
          channel.push({ phase, event: apiObj });
        },
        (err?: unknown) => {
          doneError = err;
          channel.close();
        }
      )
      .then(() => {
        this.loggerService.info({
          event: "POD_EVENTS_WATCH_ESTABLISHED",
          podName: this.podInfo.podName,
          namespace: this.podInfo.namespace
        });
      });

    for await (const { phase, event } of channel) {
      if (this.signal.aborted) break;
      writeStream.write(this.formatLine(phase, event));
    }

    if (doneError) {
      throw doneError;
    }

    return currentResourceVersion;
  }

  private formatLine(phase: string, event: CoreV1Event): string {
    const timestamp = String(event.lastTimestamp ?? event.eventTime ?? new Date().toISOString());

    return (
      JSON.stringify({
        timestamp,
        phase,
        type: event.type,
        reason: event.reason,
        message: event.message,
        involvedObject: event.involvedObject
          ? {
              kind: event.involvedObject.kind,
              name: event.involvedObject.name,
              namespace: event.involvedObject.namespace
            }
          : undefined,
        source: event.source
          ? {
              component: event.source.component,
              host: event.source.host
            }
          : undefined,
        count: event.count,
        firstTimestamp: event.firstTimestamp ? String(event.firstTimestamp) : undefined,
        lastTimestamp: event.lastTimestamp ? String(event.lastTimestamp) : undefined
      }) + "\n"
    );
  }
}
