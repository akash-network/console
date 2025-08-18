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

    fileDestination.getLastLogLine.mockResolvedValue(null);
    fileDestination.createWriteStream.mockResolvedValue(mock<NodeJS.WritableStream>());
    k8sLogClient.log.mockResolvedValue(new AbortController());

    await podLogsCollectorService.collectPodLogs();

    expect(fileDestination.getLastLogLine).toHaveBeenCalledTimes(1);
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
      message: "Starting log collection for container"
    });

    expect(loggerService.info).toHaveBeenCalledWith({
      podName: "test-pod",
      namespace: "test-namespace",
      containerName: "sidecar",
      message: "Starting log collection for container"
    });
  });

  it("should handle pod with no containers", async () => {
    const { podLogsCollectorService, loggerService, k8sLogClient } = setup({ containerNames: [] });

    await podLogsCollectorService.collectPodLogs();

    expect(k8sLogClient.log).not.toHaveBeenCalled();
    expect(loggerService.warn).toHaveBeenCalledWith({
      podName: "test-pod",
      namespace: "test-namespace",
      message: "No containers found in pod"
    });
  });

  it("should resume from last timestamp when last log line exists", async () => {
    const { podLogsCollectorService, fileDestination, k8sLogClient } = setup({ containerNames: ["app"] });
    const lastLogLine = "2024-01-15T10:30:45.123456789Z INFO Application started";
    const expectedTimestamp = new Date("2024-01-15T10:30:45.123456789Z").getTime();

    const mockWriteStream = mock<NodeJS.WritableStream>();
    const mockAbortController = new AbortController();

    fileDestination.getLastLogLine.mockResolvedValue(lastLogLine);
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

    fileDestination.getLastLogLine.mockResolvedValue(lastLogLine);
    fileDestination.createWriteStream.mockResolvedValue(mockWriteStream);
    k8sLogClient.log.mockImplementation((namespace, podName, containerName, stream) => {
      stream.write(Buffer.from(lastLogLine + "\n"));
      stream.write(Buffer.from("2024-01-15T10:30:46.123456789Z INFO New log line\n"));
      return Promise.resolve(mockAbortController);
    });

    await podLogsCollectorService.collectPodLogs();

    expect(fileDestination.getLastLogLine).toHaveBeenCalled();
    expect(fileDestination.createWriteStream).toHaveBeenCalled();
    expect(k8sLogClient.log).toHaveBeenCalled();

    expect(loggerService.info).toHaveBeenCalledWith({
      podName: "test-pod",
      namespace: "test-namespace",
      containerName: "app",
      message: "Starting log collection for container"
    });
  });

  it("should handle incomplete lines in stream chunks", async () => {
    const { podLogsCollectorService, fileDestination, k8sLogClient } = setup({ containerNames: ["app"] });

    const mockWriteStream = mock<NodeJS.WritableStream>();
    const mockAbortController = new AbortController();

    fileDestination.getLastLogLine.mockResolvedValue(null);
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

    fileDestination.getLastLogLine.mockResolvedValue(null);
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

    const mockWriteStream = mock<NodeJS.WritableStream>();
    const mockAbortController = new AbortController();

    fileDestination.getLastLogLine.mockResolvedValue(logLineWithTimestamp);
    fileDestination.createWriteStream.mockResolvedValue(mockWriteStream);
    k8sLogClient.log.mockResolvedValue(mockAbortController);

    await podLogsCollectorService.collectPodLogs();

    const expectedTimestamp = new Date("2024-01-15T10:30:45.123456789Z").getTime();
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

    fileDestination.getLastLogLine.mockResolvedValue(logLineWithoutTimestamp);
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

  function setup(overrides: { containerNames: string[] } = { containerNames: ["app"] }) {
    container.clearInstances();

    const podInfo = seedPodInfoTestData({
      podName: "test-pod",
      namespace: "test-namespace",
      containerNames: overrides.containerNames
    });
    const fileDestination = mockProvider(FileDestinationService);
    const k8sLogClient = mockProvider(K8sLog);
    const errorHandlerService = mockProvider(ErrorHandlerService);
    const loggerService = mockProvider(LoggerService);

    const podLogsCollectorService = new PodLogsCollectorService(podInfo, fileDestination, k8sLogClient, errorHandlerService, loggerService);

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
