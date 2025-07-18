import { v2 } from "@datadog/datadog-api-client";
import { singleton } from "tsyringe";

import { LoggerService } from "@src/services/logger/logger.service";
import { LogDestinationService, LogMetadata } from "@src/types/log-destination.interface";

export interface DatadogLogEntry {
  ddsource: string;
  ddtags: string;
  hostname: string;
  message: string;
  service: string;
}

@singleton()
export class DatadogService implements LogDestinationService {
  private readonly DEFAULT_CONTENT_ENCODING = "deflate";

  constructor(
    private readonly logsApi: v2.LogsApi,
    private readonly loggerService: LoggerService
  ) {
    this.loggerService.setContext(DatadogService.name);
  }

  async sendLog(logMessage: string, metadata: LogMetadata): Promise<void> {
    try {
      const datadogLogEntry = this.createDatadogLogEntry(logMessage, metadata);
      const requestParams = this.createSubmitLogRequest(datadogLogEntry);

      await this.logsApi.submitLog(requestParams);
      this.loggerService.debug({
        hostname: metadata.hostname,
        message: "Successfully sent log to Datadog"
      });
    } catch (error) {
      this.loggerService.error({
        error,
        hostname: metadata.hostname,
        message: "Error sending log to Datadog"
      });
      throw error;
    }
  }

  private createDatadogLogEntry(logMessage: string, metadata: LogMetadata): DatadogLogEntry {
    return {
      ddsource: metadata.source,
      ddtags: this.formatDatadogTags(metadata),
      hostname: metadata.hostname,
      message: this.sanitizeLogMessage(logMessage),
      service: metadata.service
    };
  }

  private formatDatadogTags(metadata: LogMetadata): string {
    const baseTags = [`env:${metadata.environment}`];
    const metadataTags = Object.entries(metadata.tags).map(([key, value]) => `${key}:${value}`);

    return [...baseTags, ...metadataTags].join(",");
  }

  private sanitizeLogMessage(logMessage: string): string {
    return logMessage.trim();
  }

  private createSubmitLogRequest(logEntry: DatadogLogEntry): v2.LogsApiSubmitLogRequest {
    return {
      body: [logEntry],
      contentEncoding: this.DEFAULT_CONTENT_ENCODING
    };
  }
}
