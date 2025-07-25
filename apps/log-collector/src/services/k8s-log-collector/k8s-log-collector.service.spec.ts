import { mock } from "jest-mock-extended";
import { container } from "tsyringe";

import { FileDestinationFactory } from "@src/factories/file-destination/file-destination.factory";
import { PodLogsCollectorFactory } from "@src/factories/pod-logs-collector/pod-logs-collector.factory";
import { ErrorHandlerService } from "@src/services/error-handler/error-handler.service";
import type { FileDestinationService } from "@src/services/file-destination/file-destination.service";
import { LoggerService } from "@src/services/logger/logger.service";
import type { PodInfo } from "@src/services/pod-discovery/pod-discovery.service";
import { PodDiscoveryService } from "@src/services/pod-discovery/pod-discovery.service";
import type { PodLogsCollectorService } from "@src/services/pod-logs-collector/pod-logs-collector.service";
import { K8sLogCollectorService } from "./k8s-log-collector.service";

import { seedPodInfoTestData } from "@test/seeders/pod-info.seeder";
import { mockProvider } from "@test/utils/mock-provider.util";

describe(K8sLogCollectorService.name, () => {
  it("should start log collection for all pods in namespace", async () => {
    const { k8sLogCollectorService, podDiscoveryService, podLogsCollectorFactory, fileDestinationFactory, errorHandlerService } = setup();
    const pods: PodInfo[] = [seedPodInfoTestData(), seedPodInfoTestData()];

    const mockPodLogsCollector = mock<PodLogsCollectorService>();
    mockPodLogsCollector.collectPodLogs.mockResolvedValue();

    const mockFileDestination1 = mock<FileDestinationService>();
    const mockFileDestination2 = mock<FileDestinationService>();

    podDiscoveryService.discoverPodsInNamespace.mockResolvedValue(pods);
    podLogsCollectorFactory.create.mockReturnValue(mockPodLogsCollector);
    fileDestinationFactory.create.mockReturnValueOnce(mockFileDestination1).mockReturnValueOnce(mockFileDestination2);

    await k8sLogCollectorService.start();

    expect(podDiscoveryService.discoverPodsInNamespace).toHaveBeenCalled();
    expect(fileDestinationFactory.create).toHaveBeenCalledTimes(2);
    expect(podLogsCollectorFactory.create).toHaveBeenCalledTimes(2);

    expect(fileDestinationFactory.create).toHaveBeenNthCalledWith(1, pods[0]);
    expect(fileDestinationFactory.create).toHaveBeenNthCalledWith(2, pods[1]);

    expect(podLogsCollectorFactory.create).toHaveBeenNthCalledWith(1, pods[0], mockFileDestination1);
    expect(podLogsCollectorFactory.create).toHaveBeenNthCalledWith(2, pods[1], mockFileDestination2);

    expect(mockPodLogsCollector.collectPodLogs).toHaveBeenCalledTimes(2);
    expect(errorHandlerService.aggregateConcurrentResults).toHaveBeenCalledWith(
      expect.arrayContaining([expect.any(Promise)]),
      { totalPods: 2 },
      "pod log collection"
    );
  });

  it("should handle empty namespace gracefully", async () => {
    const { k8sLogCollectorService, podDiscoveryService, loggerService } = setup();

    podDiscoveryService.discoverPodsInNamespace.mockResolvedValue([]);

    await k8sLogCollectorService.start();

    expect(loggerService.warn).toHaveBeenCalledWith({
      message: "No pods found to collect logs from. Exiting."
    });
  });

  function setup() {
    container.clearInstances();

    const podDiscoveryService = mockProvider(PodDiscoveryService);
    const loggerService = mockProvider(LoggerService);
    const errorHandlerService = mockProvider(ErrorHandlerService);
    const podLogsCollectorFactory = mockProvider(PodLogsCollectorFactory);
    const fileDestinationFactory = mockProvider(FileDestinationFactory);

    const k8sLogCollectorService = container.resolve(K8sLogCollectorService);

    return {
      k8sLogCollectorService,
      podDiscoveryService,
      podLogsCollectorFactory,
      fileDestinationFactory,
      loggerService,
      errorHandlerService
    };
  }
});
