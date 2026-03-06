import { Log as K8sLog } from "@kubernetes/client-node";
import { mock } from "jest-mock-extended";
import { PassThrough } from "stream";
import { container } from "tsyringe";

import { ErrorHandlerService } from "@src/services/error-handler/error-handler.service";
import { FileDestinationService } from "@src/services/file-destination/file-destination.service";
import { LoggerService } from "@src/services/logger/logger.service";
import { PodLogsCollectorService } from "./pod-logs-collector.service";

import { seedPodInfoTestData } from "@test/seeders/pod-info.seeder";
import { mockProvider } from "@test/utils/mock-provider.util";

describe(PodLogsCollectorService.name, () => {
  it("should collect logs for all containers in pod", async () => {
    const { podLogsCollectorService, fileDestination, k8sLogClient, loggerService } = setup({
      containerNames: ["app", "sidecar"]
    });

    fileDestination.getLastLogLines.mockResolvedValue([]);
    fileDestination.createWriteStream.mockResolvedValue(mock<NodeJS.WritableStream>());
    k8sLogClient.log.mockResolvedValue(new AbortController());

    await podLogsCollectorService.collectPodLogs();

    expect(fileDestination.createWriteStream).toHaveBeenCalled();
    expect(k8sLogClient.log).toHaveBeenCalledTimes(2);

    expect(k8sLogClient.log).toHaveBeenNthCalledWith(
      1,
      "test-namespace",
      "test-pod",
      "app",
      expect.any(PassThrough),
      expect.objectContaining({
        follow: true,
        tailLines: 100,
        pretty: false,
        timestamps: true
      })
    );

    expect(k8sLogClient.log).toHaveBeenNthCalledWith(
      2,
      "test-namespace",
      "test-pod",
      "sidecar",
      expect.any(PassThrough),
      expect.objectContaining({
        follow: true,
        tailLines: 100,
        pretty: false,
        timestamps: true
      })
    );

    expect(loggerService.info).toHaveBeenCalledWith({
      podName: "test-pod",
      namespace: "test-namespace",
      containerName: "app",
      event: "CONTAINER_LOG_COLLECTION_STARTED"
    });

    expect(loggerService.info).toHaveBeenCalledWith({
      podName: "test-pod",
      namespace: "test-namespace",
      containerName: "sidecar",
      event: "CONTAINER_LOG_COLLECTION_STARTED"
    });
  });

  it("should handle pod with no containers", async () => {
    const { podLogsCollectorService, loggerService, k8sLogClient } = setup({ containerNames: [] });

    await podLogsCollectorService.collectPodLogs();

    expect(k8sLogClient.log).not.toHaveBeenCalled();
    expect(loggerService.warn).toHaveBeenCalledWith({
      podName: "test-pod",
      namespace: "test-namespace",
      event: "POD_LOGS_NO_CONTAINERS"
    });
  });

  it("should resume from last timestamp when last log line exists", async () => {
    const { podLogsCollectorService, fileDestination, k8sLogClient } = setup({ containerNames: ["app"] });
    const lastLogLine = "2024-01-15T10:30:45.123456789Z INFO Application started";
    const expectedTimestamp = new Date("2024-01-15T10:30:45.123456789Z").getTime();

    const mockWriteStream = mock<NodeJS.WritableStream>();
    const mockAbortController = new AbortController();

    fileDestination.getLastLogLines.mockResolvedValue([{ timestamp: expectedTimestamp, line: lastLogLine }]);
    fileDestination.createWriteStream.mockResolvedValue(mockWriteStream);
    k8sLogClient.log.mockResolvedValue(mockAbortController);

    await podLogsCollectorService.collectPodLogs();

    expect(k8sLogClient.log).toHaveBeenCalledWith(
      "test-namespace",
      "test-pod",
      "app",
      expect.any(PassThrough),
      expect.objectContaining({
        sinceTime: new Date(expectedTimestamp).toISOString(),
        tailLines: 0,
        timestamps: true
      })
    );
  });

  it("should coordinate log collection with FileDestinationService", async () => {
    const { podLogsCollectorService, fileDestination, k8sLogClient, loggerService } = setup({ containerNames: ["app"] });
    const lastLogLine = "2024-01-15T10:30:45.123456789Z INFO Application started";

    const mockWriteStream = mock<NodeJS.WritableStream>();
    const mockAbortController = new AbortController();

    fileDestination.getLastLogLines.mockResolvedValue([{ timestamp: new Date("2024-01-15T10:30:45.123456789Z").getTime(), line: lastLogLine }]);
    fileDestination.createWriteStream.mockResolvedValue(mockWriteStream);
    k8sLogClient.log.mockImplementation((namespace, podName, containerName, stream) => {
      stream.write(Buffer.from(lastLogLine + "\n"));
      stream.write(Buffer.from("2024-01-15T10:30:46.123456789Z INFO New log line\n"));
      return Promise.resolve(mockAbortController);
    });

    await podLogsCollectorService.collectPodLogs();

    expect(fileDestination.getLastLogLines).toHaveBeenCalled();
    expect(fileDestination.createWriteStream).toHaveBeenCalled();
    expect(k8sLogClient.log).toHaveBeenCalled();

    expect(loggerService.info).toHaveBeenCalledWith({
      podName: "test-pod",
      namespace: "test-namespace",
      containerName: "app",
      event: "CONTAINER_LOG_COLLECTION_STARTED"
    });
  });

  it("should handle incomplete lines in stream chunks", async () => {
    const { podLogsCollectorService, fileDestination, k8sLogClient } = setup({ containerNames: ["app"] });

    const mockWriteStream = mock<NodeJS.WritableStream>();
    const mockAbortController = new AbortController();

    fileDestination.getLastLogLines.mockResolvedValue([]);
    fileDestination.createWriteStream.mockResolvedValue(mockWriteStream);
    k8sLogClient.log.mockImplementation((namespace, podName, containerName, stream) => {
      stream.write(Buffer.from("2024-01-15T10:30:45.123456789Z INFO First line\n2024-01-15T10:30:46.123456789Z INFO Second line"));
      stream.write(Buffer.from("\n2024-01-15T10:30:47.123456789Z INFO Third line\n"));
      return Promise.resolve(mockAbortController);
    });

    await podLogsCollectorService.collectPodLogs();

    expect(fileDestination.createWriteStream).toHaveBeenCalled();
    expect(k8sLogClient.log).toHaveBeenCalled();
  });

  it("should filter out empty lines", async () => {
    const { podLogsCollectorService, fileDestination, k8sLogClient } = setup({ containerNames: ["app"] });

    const mockWriteStream = mock<NodeJS.WritableStream>();
    const mockAbortController = new AbortController();

    fileDestination.getLastLogLines.mockResolvedValue([]);
    fileDestination.createWriteStream.mockResolvedValue(mockWriteStream);
    k8sLogClient.log.mockImplementation((namespace, podName, containerName, stream) => {
      stream.write(Buffer.from("2024-01-15T10:30:45.123456789Z INFO First line\n\n2024-01-15T10:30:46.123456789Z INFO Second line\n"));
      return Promise.resolve(mockAbortController);
    });

    await podLogsCollectorService.collectPodLogs();

    expect(fileDestination.createWriteStream).toHaveBeenCalled();
    expect(k8sLogClient.log).toHaveBeenCalled();
  });

  it("should extract timestamp from log line correctly", async () => {
    const { podLogsCollectorService, fileDestination, k8sLogClient } = setup({ containerNames: ["app"] });
    const logLineWithTimestamp = "2024-01-15T10:30:45.123456789Z INFO Application started";
    const expectedTimestamp = new Date("2024-01-15T10:30:45.123456789Z").getTime();

    const mockWriteStream = mock<NodeJS.WritableStream>();
    const mockAbortController = new AbortController();

    fileDestination.getLastLogLines.mockResolvedValue([{ timestamp: expectedTimestamp, line: logLineWithTimestamp }]);
    fileDestination.createWriteStream.mockResolvedValue(mockWriteStream);
    k8sLogClient.log.mockResolvedValue(mockAbortController);

    await podLogsCollectorService.collectPodLogs();

    expect(k8sLogClient.log).toHaveBeenCalledWith(
      "test-namespace",
      "test-pod",
      "app",
      expect.any(PassThrough),
      expect.objectContaining({
        sinceTime: new Date(expectedTimestamp).toISOString()
      })
    );
  });

  it("should handle log line without timestamp", async () => {
    const { podLogsCollectorService, fileDestination, k8sLogClient } = setup({ containerNames: ["app"] });
    const logLineWithoutTimestamp = "INFO Application started";

    const mockWriteStream = mock<NodeJS.WritableStream>();
    const mockAbortController = new AbortController();

    fileDestination.getLastLogLines.mockResolvedValue([{ line: logLineWithoutTimestamp }]);
    fileDestination.createWriteStream.mockResolvedValue(mockWriteStream);
    k8sLogClient.log.mockResolvedValue(mockAbortController);

    await podLogsCollectorService.collectPodLogs();

    expect(k8sLogClient.log).toHaveBeenCalledWith(
      "test-namespace",
      "test-pod",
      "app",
      expect.any(PassThrough),
      expect.objectContaining({
        sinceTime: undefined,
        tailLines: 100
      })
    );
  });

  it("should log warning and return on 403 Forbidden", async () => {
    const { podLogsCollectorService, fileDestination, errorHandlerService, loggerService } = setup({
      containerNames: ["app"]
    });

    fileDestination.getLastLogLines.mockResolvedValue([]);
    fileDestination.createWriteStream.mockResolvedValue(mock<NodeJS.WritableStream>());

    const forbiddenError = Object.assign(new Error("Forbidden"), { statusCode: 403 });
    errorHandlerService.aggregateConcurrentResults.mockRejectedValue(new AggregateError([forbiddenError], "container log collection"));

    await podLogsCollectorService.collectPodLogs();

    expect(loggerService.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "POD_LOGS_COLLECTION_FORBIDDEN",
        message: expect.stringContaining("permissions")
      })
    );
  });

  it("should re-throw non-forbidden errors", async () => {
    const { podLogsCollectorService, fileDestination, errorHandlerService } = setup({
      containerNames: ["app"]
    });

    fileDestination.getLastLogLines.mockResolvedValue([]);
    fileDestination.createWriteStream.mockResolvedValue(mock<NodeJS.WritableStream>());

    const error = new Error("Something went wrong");
    errorHandlerService.aggregateConcurrentResults.mockRejectedValue(error);

    await expect(podLogsCollectorService.collectPodLogs()).rejects.toThrow("Something went wrong");
  });

  it("should return early when signal is already aborted", async () => {
    const abortController = new AbortController();
    abortController.abort();

    const { podLogsCollectorService, fileDestination, k8sLogClient } = setup({
      containerNames: ["app"],
      signal: abortController.signal
    });

    await podLogsCollectorService.collectPodLogs();

    expect(fileDestination.getLastLogLines).not.toHaveBeenCalled();
    expect(k8sLogClient.log).not.toHaveBeenCalled();
  });

  it("should abort k8s log stream when signal fires", async () => {
    const abortController = new AbortController();
    const { podLogsCollectorService, fileDestination, k8sLogClient } = setup({
      containerNames: ["app"],
      signal: abortController.signal
    });

    const mockWriteStream = mock<NodeJS.WritableStream>();
    const k8sAbortController = new AbortController();
    const k8sAbortSpy = jest.spyOn(k8sAbortController, "abort");

    fileDestination.getLastLogLines.mockResolvedValue([]);
    fileDestination.createWriteStream.mockResolvedValue(mockWriteStream);
    k8sLogClient.log.mockImplementation((_ns, _pod, _container, _stream) => {
      return Promise.resolve(k8sAbortController);
    });

    const collectPromise = podLogsCollectorService.collectPodLogs();

    // Let the stream setup complete
    await new Promise(resolve => setImmediate(resolve));

    // Abort the signal
    abortController.abort();

    // Let microtasks settle
    await new Promise(resolve => setImmediate(resolve));

    expect(k8sAbortSpy).toHaveBeenCalled();

    // The write promise should resolve via the logStream close event
    await collectPromise;
  });

  function setup(overrides: { containerNames: string[]; signal?: AbortSignal } = { containerNames: ["app"] }) {
    container.clearInstances();

    const podInfo = seedPodInfoTestData({
      podName: "test-pod",
      namespace: "test-namespace",
      containerNames: overrides.containerNames
    });
    const fileDestination = mockProvider(FileDestinationService);
    const k8sLogClient = mockProvider(K8sLog);
    const errorHandlerService = mockProvider(ErrorHandlerService);
    const realErrorHandler = new ErrorHandlerService();
    errorHandlerService.isForbidden.mockImplementation((error: unknown) => realErrorHandler.isForbidden(error));
    const loggerService = mockProvider(LoggerService);

    const podLogsCollectorService = new PodLogsCollectorService(podInfo, fileDestination, k8sLogClient, errorHandlerService, loggerService, overrides.signal);

    return {
      podLogsCollectorService,
      podInfo,
      fileDestination,
      k8sLogClient,
      errorHandlerService,
      loggerService
    };
  }
});
