import { faker } from "@faker-js/faker";
import { CoreV1Api, KubeConfig, Log } from "@kubernetes/client-node";
import { container } from "tsyringe";

import { PROCESS_ENV } from "@src/providers/process-env.provider";
import { LoggerService } from "@src/services/logger/logger.service";
import { K8sLogCollectorService } from "./k8s-log-collector.service";

import type { ConfigTestData } from "@test/seeders/config.seeder";
import { seedConfigTestData, seedMinimalConfigTestData } from "@test/seeders/config.seeder";
import { seedK8sTestData } from "@test/seeders/k8s-log-collector.seeder";
import { mockProvider } from "@test/utils/mock-provider.util";

describe(K8sLogCollectorService.name, () => {
  it("should collect logs from pods in namespace", async () => {
    const config = seedConfigTestData();
    const { k8sLogCollectorService, k8sClient, k8sLogClient, loggerService, namespace } = setup(config);
    const { pods, logDestination } = seedK8sTestData();

    k8sClient.listNamespacedPod.mockResolvedValue({ items: pods });
    k8sClient.readNamespacedPod.mockResolvedValue({
      spec: { containers: [{ name: "main-container" }] }
    });
    k8sLogClient.log.mockResolvedValue(new AbortController());

    await k8sLogCollectorService.collectLogs(logDestination);

    expect(k8sClient.listNamespacedPod).toHaveBeenCalledWith({ namespace });
    expect(loggerService.info).toHaveBeenCalledWith({
      currentPodName: config.HOSTNAME,
      namespace,
      message: "Starting log collection"
    });
  });

  it("should handle empty namespace gracefully", async () => {
    const config = seedConfigTestData();
    const { k8sLogCollectorService, k8sClient, loggerService, namespace } = setup(config);
    const { logDestination } = seedK8sTestData();

    k8sClient.listNamespacedPod.mockResolvedValue({ items: [] });

    await k8sLogCollectorService.collectLogs(logDestination);

    expect(loggerService.warn).toHaveBeenCalledWith({
      namespace,
      message: "No pods found in namespace"
    });
  });

  it("should handle errors during log collection", async () => {
    const config = seedConfigTestData();
    const { k8sLogCollectorService, k8sClient, loggerService } = setup(config);
    const { logDestination } = seedK8sTestData();
    const error = new Error("Kubernetes API error");

    k8sClient.listNamespacedPod.mockRejectedValue(error);

    await expect(k8sLogCollectorService.collectLogs(logDestination)).rejects.toThrow("Kubernetes API error");

    expect(loggerService.error).toHaveBeenCalledWith({
      error,
      message: "Error collecting logs"
    });
  });

  it("should fail when no kubeconfig context is available", async () => {
    const config = seedMinimalConfigTestData();
    const { k8sLogCollectorService, kubeConfig } = setup(config);
    const { logDestination } = seedK8sTestData();
    kubeConfig.getContextObject.mockReturnValue(null);

    await expect(k8sLogCollectorService.collectLogs(logDestination)).rejects.toThrow("Context object not found for current context: test-context");
  });

  it("should fail when kubeconfig context has no namespace", async () => {
    const config = seedMinimalConfigTestData();
    const { k8sLogCollectorService, kubeConfig } = setup(config);
    const { logDestination } = seedK8sTestData();

    kubeConfig.getCurrentContext.mockReturnValue("test-context");
    kubeConfig.getContextObject.mockReturnValue({
      cluster: faker.internet.domainWord(),
      user: faker.internet.domainWord(),
      name: faker.internet.domainWord(),
      namespace: undefined
    });

    await expect(k8sLogCollectorService.collectLogs(logDestination)).rejects.toThrow(
      "No namespace provided in k8s context: test-context. Please set namespace in context or provide KUBERNETES_NAMESPACE_OVERRIDE"
    );
  });

  function setup(config: ConfigTestData) {
    container.clearInstances();

    const k8sClient = mockProvider(CoreV1Api);
    const k8sLogClient = mockProvider(Log);
    const kubeConfig = mockProvider(KubeConfig);
    const loggerService = mockProvider(LoggerService);
    container.register(PROCESS_ENV, { useValue: config });

    const k8sLogCollectorService = container.resolve(K8sLogCollectorService);

    const namespace = faker.internet.domainWord();
    kubeConfig.getCurrentContext.mockReturnValue("test-context");
    kubeConfig.getContextObject.mockReturnValue({
      cluster: faker.internet.domainWord(),
      user: faker.internet.domainWord(),
      name: faker.internet.domainWord(),
      namespace
    });

    return {
      k8sLogCollectorService,
      k8sClient,
      k8sLogClient,
      kubeConfig,
      loggerService,
      namespace
    };
  }
});
