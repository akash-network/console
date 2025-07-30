import { v2 } from "@datadog/datadog-api-client";
import { mock } from "jest-mock-extended";
import { container } from "tsyringe";

import { LoggerService } from "@src/services/logger/logger.service";
import { DatadogService } from "./datadog.service";

import { seedDatadogLogEntry, seedDatadogTestData } from "@test/seeders/datadog.seeder";

describe(DatadogService.name, () => {
  it("should send log to Datadog successfully", async () => {
    const { datadogService, logsApi, loggerService } = setup();
    const { logMessage, metadata } = seedDatadogTestData();

    await datadogService.sendLog(logMessage, metadata);

    const expectedLogEntry = seedDatadogLogEntry(logMessage, metadata);
    expect(logsApi.submitLog).toHaveBeenCalledWith({
      body: [expectedLogEntry],
      contentEncoding: "deflate"
    });
    expect(loggerService.debug).toHaveBeenCalledWith({
      hostname: metadata.hostname,
      message: "Successfully sent log to Datadog"
    });
  });

  it("should handle errors when sending log to Datadog", async () => {
    const { datadogService, logsApi, loggerService } = setup();
    const { logMessage, metadata } = seedDatadogTestData();
    const error = new Error("Datadog API error");
    logsApi.submitLog.mockRejectedValue(error);

    await expect(datadogService.sendLog(logMessage, metadata)).rejects.toThrow("Datadog API error");

    expect(loggerService.error).toHaveBeenCalledWith({
      error,
      hostname: metadata.hostname,
      message: "Error sending log to Datadog"
    });
  });

  it("should sanitize log message by trimming whitespace", async () => {
    const { datadogService, logsApi } = setup();
    const { metadata } = seedDatadogTestData();
    const logMessage = "  \n  test log message  \n  ";

    await datadogService.sendLog(logMessage, metadata);

    const expectedLogEntry = seedDatadogLogEntry("test log message", metadata);
    expect(logsApi.submitLog).toHaveBeenCalledWith({
      body: [expectedLogEntry],
      contentEncoding: "deflate"
    });
  });

  it("should handle empty tags gracefully", async () => {
    const { datadogService, logsApi } = setup();
    const { logMessage } = seedDatadogTestData();
    const metadata = seedDatadogTestData().metadata;
    metadata.tags = {};

    await datadogService.sendLog(logMessage, metadata);

    const expectedLogEntry = {
      ddsource: metadata.source,
      ddtags: `env:${metadata.environment}`,
      hostname: metadata.hostname,
      message: logMessage.trim(),
      service: metadata.service
    };
    expect(logsApi.submitLog).toHaveBeenCalledWith({
      body: [expectedLogEntry],
      contentEncoding: "deflate"
    });
  });

  function setup() {
    container.clearInstances();

    const logsApi = mock<v2.LogsApi>();
    const loggerService = mock<LoggerService>();

    container.register(v2.LogsApi, { useValue: logsApi });
    container.register(LoggerService, { useValue: loggerService });

    const datadogService = container.resolve(DatadogService);

    return {
      datadogService,
      logsApi,
      loggerService
    };
  }
});
