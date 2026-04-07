import { container } from "tsyringe";
import { mock } from "vitest-mock-extended";

import { FileDestinationFactory } from "@src/factories/file-destination/file-destination.factory";
import { PodEventsCollectorFactory } from "@src/factories/pod-events-collector/pod-events-collector.factory";
import { PodLogsCollectorFactory } from "@src/factories/pod-logs-collector/pod-logs-collector.factory";
import { ErrorHandlerService } from "@src/services/error-handler/error-handler.service";
import type { FileDestinationService } from "@src/services/file-destination/file-destination.service";
import type { K8sEventsCollectorService } from "@src/services/k8s-events-collector/k8s-events-collector.service";
import { LoggerService } from "@src/services/logger/logger.service";
import type { PodCallback, PodInfo } from "@src/services/pod-discovery/pod-discovery.service";
import { PodDiscoveryService } from "@src/services/pod-discovery/pod-discovery.service";
import type { PodLogsCollectorService } from "@src/services/pod-logs-collector/pod-logs-collector.service";
import { K8sCollectorService } from "./k8s-collector.service";

import { seedPodInfoTestData } from "@test/seeders/pod-info.seeder";
import { mockProvider } from "@test/utils/mock-provider.util";

describe(K8sCollectorService.name, () => {
  it("should start log and event collection for each pod discovered by watchPods", async () => {
    const { k8sCollectorService, podDiscoveryService, podLogsCollectorFactory, podEventsCollectorFactory, fileDestinationFactory } = setup();
    const pods: PodInfo[] = [seedPodInfoTestData(), seedPodInfoTestData()];

    const mockPodLogsCollector = mock<PodLogsCollectorService>();
    mockPodLogsCollector.collectPodLogs.mockResolvedValue();

    const mockPodEventsCollector = mock<K8sEventsCollectorService>();
    mockPodEventsCollector.collectPodEvents.mockResolvedValue();

    const mockFileDestination1 = mock<FileDestinationService>();
    const mockFileDestination2 = mock<FileDestinationService>();

    podDiscoveryService.watchPods.mockImplementation(async (callback: PodCallback) => {
      callback(pods[0], new AbortController().signal);
      callback(pods[1], new AbortController().signal);
    });

    podLogsCollectorFactory.create.mockReturnValue(mockPodLogsCollector);
    podEventsCollectorFactory.create.mockReturnValue(mockPodEventsCollector);
    fileDestinationFactory.create.mockReturnValueOnce(mockFileDestination1).mockReturnValueOnce(mockFileDestination2);

    await k8sCollectorService.start();

    expect(podDiscoveryService.watchPods).toHaveBeenCalledWith(expect.any(Function));
    expect(fileDestinationFactory.create).toHaveBeenCalledTimes(2);
    expect(podLogsCollectorFactory.create).toHaveBeenCalledTimes(2);
    expect(podEventsCollectorFactory.create).toHaveBeenCalledTimes(2);

    expect(podLogsCollectorFactory.create).toHaveBeenNthCalledWith(1, pods[0], mockFileDestination1, expect.any(AbortSignal));
    expect(podEventsCollectorFactory.create).toHaveBeenNthCalledWith(1, pods[0], mockFileDestination1, expect.any(AbortSignal));

    expect(mockPodLogsCollector.collectPodLogs).toHaveBeenCalledTimes(2);
    expect(mockPodEventsCollector.collectPodEvents).toHaveBeenCalledTimes(2);
  });

  it("should handle forbidden error from watchPods gracefully", async () => {
    const { k8sCollectorService, podDiscoveryService, loggerService, errorHandlerService } = setup();

    const forbiddenError = Object.assign(new Error("Forbidden"), { statusCode: 403 });
    podDiscoveryService.watchPods.mockRejectedValue(forbiddenError);
    errorHandlerService.isForbidden.mockReturnValue(true);

    await k8sCollectorService.start();

    expect(loggerService.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "POD_DISCOVERY_FORBIDDEN" }));
  });

  it("should re-throw non-forbidden errors from watchPods", async () => {
    const { k8sCollectorService, podDiscoveryService, errorHandlerService } = setup();

    const error = new Error("Connection refused");
    podDiscoveryService.watchPods.mockRejectedValue(error);
    errorHandlerService.isForbidden.mockReturnValue(false);

    await expect(k8sCollectorService.start()).rejects.toThrow("Connection refused");
  });

  it("should log error and propagate as unhandled rejection when pod collection fails", async () => {
    const { k8sCollectorService, podDiscoveryService, podLogsCollectorFactory, podEventsCollectorFactory, fileDestinationFactory, loggerService } = setup();
    const pod = seedPodInfoTestData();

    const mockPodLogsCollector = mock<PodLogsCollectorService>();
    const collectionError = new Error("Stream failed");
    mockPodLogsCollector.collectPodLogs.mockRejectedValue(collectionError);

    const mockPodEventsCollector = mock<K8sEventsCollectorService>();
    mockPodEventsCollector.collectPodEvents.mockResolvedValue();

    const rejections: unknown[] = [];
    const handler = (reason: unknown) => rejections.push(reason);
    process.on("unhandledRejection", handler);

    podDiscoveryService.watchPods.mockImplementation(async (callback: PodCallback) => {
      callback(pod, new AbortController().signal);
    });

    podLogsCollectorFactory.create.mockReturnValue(mockPodLogsCollector);
    podEventsCollectorFactory.create.mockReturnValue(mockPodEventsCollector);
    fileDestinationFactory.create.mockReturnValue(mock<FileDestinationService>());

    await k8sCollectorService.start();
    await new Promise(resolve => setTimeout(resolve, 0));

    process.off("unhandledRejection", handler);

    expect(rejections[0]).toBe(collectionError);
    expect(loggerService.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "POD_COLLECTION_FAILED",
        podName: pod.podName,
        error: collectionError
      })
    );
  });

  function setup() {
    container.clearInstances();

    const podDiscoveryService = mockProvider(PodDiscoveryService);
    const loggerService = mockProvider(LoggerService);
    const errorHandlerService = mockProvider(ErrorHandlerService);
    const podLogsCollectorFactory = mockProvider(PodLogsCollectorFactory);
    const podEventsCollectorFactory = mockProvider(PodEventsCollectorFactory);
    const fileDestinationFactory = mockProvider(FileDestinationFactory);

    const k8sCollectorService = container.resolve(K8sCollectorService);

    return {
      k8sCollectorService,
      podDiscoveryService,
      podLogsCollectorFactory,
      podEventsCollectorFactory,
      fileDestinationFactory,
      loggerService,
      errorHandlerService
    };
  }
});
