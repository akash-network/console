import { faker } from "@faker-js/faker";
import type { Context, CoreV1Api, KubeConfig, V1Pod } from "@kubernetes/client-node";
import { mock } from "jest-mock-extended";
import { container } from "tsyringe";

import { ConfigService } from "@src/services/config/config.service";
import { LoggerService } from "@src/services/logger/logger.service";
import { PodDiscoveryService } from "./pod-discovery.service";

import { seedKubernetesPodTestData } from "@test/seeders/kubernetes-pod.seeder";
import { mockProvider } from "@test/utils/mock-provider.util";

describe(PodDiscoveryService.name, () => {
  it("should discover pods in namespace successfully and exclude pods from same deployment", async () => {
    const namespace = faker.internet.domainWord();
    const { podDiscoveryService, k8sClient, loggerService } = setup({
      KUBERNETES_NAMESPACE_OVERRIDE: namespace
    });
    const currentPodName = "log-collector-6bdb59678c-w9jww";
    const podsRaw = [
      seedKubernetesPodTestData({
        metadata: { name: "web-78d5c9c5b-hxqxs", namespace },
        spec: { containers: [{ name: "app" }, { name: "sidecar" }] }
      }),
      seedKubernetesPodTestData({
        metadata: { name: "api-abc123-def456", namespace },
        spec: { containers: [{ name: "nginx" }] }
      }),
      seedKubernetesPodTestData({
        metadata: { name: currentPodName, namespace },
        spec: { containers: [{ name: "collector" }] }
      }),
      seedKubernetesPodTestData({
        metadata: { name: "log-collector-c5f7d6bc5-d8nrl", namespace },
        spec: { containers: [{ name: "collector" }] }
      }),
      seedKubernetesPodTestData({
        metadata: { name: "log-collector-xyz789-abc123", namespace },
        spec: { containers: [{ name: "collector" }] }
      })
    ];

    k8sClient.listNamespacedPod.mockResolvedValue({ items: podsRaw });

    const result = await podDiscoveryService.discoverPodsInNamespace();

    expect(result).toHaveLength(2);
    expect(result[0].podName).toBe("web-78d5c9c5b-hxqxs");
    expect(result[1].podName).toBe("api-abc123-def456");

    expect(result.find(pod => pod.podName === currentPodName)).toBeUndefined();
    expect(result.find(pod => pod.podName === "log-collector-c5f7d6bc5-d8nrl")).toBeUndefined();
    expect(result.find(pod => pod.podName === "log-collector-xyz789-abc123")).toBeUndefined();

    expect(k8sClient.listNamespacedPod).toHaveBeenCalledWith({
      namespace,
      labelSelector: undefined
    });

    expect(loggerService.info).toHaveBeenCalledWith({
      message: "Discovering pods in namespace",
      namespace
    });

    expect(loggerService.info).toHaveBeenCalledWith({
      namespace,
      totalPods: 5,
      targetPods: 2,
      currentPodName,
      message: "Pod discovery completed"
    });
  });

  it("should use namespace override when provided", async () => {
    const overrideNamespace = faker.internet.domainWord();
    const { podDiscoveryService, k8sClient } = setup({
      KUBERNETES_NAMESPACE_OVERRIDE: overrideNamespace
    });

    k8sClient.listNamespacedPod.mockResolvedValue({ items: [] });

    await podDiscoveryService.discoverPodsInNamespace();

    expect(k8sClient.listNamespacedPod).toHaveBeenCalledWith({
      namespace: overrideNamespace,
      labelSelector: undefined
    });
  });

  it("should get namespace from kubeconfig when no override provided", async () => {
    const { podDiscoveryService, kubeConfig, k8sClient } = setup();
    const kubeconfigNamespace = faker.internet.domainWord();
    const currentContext = faker.internet.domainWord();

    kubeConfig.getCurrentContext.mockReturnValue(currentContext);
    kubeConfig.getContextObject.mockReturnValue({
      name: currentContext,
      cluster: faker.internet.domainWord(),
      user: faker.internet.domainWord(),
      namespace: kubeconfigNamespace
    } as Context);
    k8sClient.listNamespacedPod.mockResolvedValue({ items: [] });

    await podDiscoveryService.discoverPodsInNamespace();

    expect(kubeConfig.getCurrentContext).toHaveBeenCalled();
    expect(kubeConfig.getContextObject).toHaveBeenCalledWith(currentContext);
    expect(k8sClient.listNamespacedPod).toHaveBeenCalledWith({
      namespace: kubeconfigNamespace,
      labelSelector: undefined
    });
  });

  it("should throw error when kubeconfig context not found", async () => {
    const { podDiscoveryService, kubeConfig } = setup();
    const currentContext = faker.internet.domainWord();

    kubeConfig.getCurrentContext.mockReturnValue(currentContext);
    kubeConfig.getContextObject.mockReturnValue(null);

    await expect(podDiscoveryService.discoverPodsInNamespace()).rejects.toThrow(`Context object not found for current context: ${currentContext}`);
  });

  it("should throw error when kubeconfig context has no namespace", async () => {
    const { podDiscoveryService, kubeConfig } = setup();
    const currentContext = faker.internet.domainWord();

    kubeConfig.getCurrentContext.mockReturnValue(currentContext);
    kubeConfig.getContextObject.mockReturnValue({
      name: currentContext,
      cluster: faker.internet.domainWord(),
      user: faker.internet.domainWord(),
      namespace: undefined
    } as Context);

    await expect(podDiscoveryService.discoverPodsInNamespace()).rejects.toThrow(
      `No namespace provided in k8s context: ${currentContext}. Please set namespace in context or provide KUBERNETES_NAMESPACE_OVERRIDE`
    );
  });

  it("should handle empty pod list", async () => {
    const namespace = faker.internet.domainWord();
    const { podDiscoveryService, k8sClient, loggerService } = setup({
      KUBERNETES_NAMESPACE_OVERRIDE: namespace
    });
    const currentPodName = "log-collector-6bdb59678c-w9jww";

    k8sClient.listNamespacedPod.mockResolvedValue({ items: [] });

    const result = await podDiscoveryService.discoverPodsInNamespace();

    expect(result).toHaveLength(0);
    expect(loggerService.info).toHaveBeenCalledWith({
      namespace,
      totalPods: 0,
      targetPods: 0,
      currentPodName,
      message: "Pod discovery completed"
    });
  });

  it("should handle pod names with insufficient parts for deployment extraction", async () => {
    const namespace = faker.internet.domainWord();
    const { podDiscoveryService, k8sClient, loggerService } = setup({
      KUBERNETES_NAMESPACE_OVERRIDE: namespace,
      HOSTNAME: "simple-pod" // Only 2 parts, not enough for deployment extraction
    });
    const podsRaw = [
      seedKubernetesPodTestData({
        metadata: { name: "simple-pod", namespace },
        spec: { containers: [{ name: "app" }] }
      }),
      seedKubernetesPodTestData({
        metadata: { name: "other-pod", namespace },
        spec: { containers: [{ name: "nginx" }] }
      })
    ];

    k8sClient.listNamespacedPod.mockResolvedValue({ items: podsRaw });

    const result = await podDiscoveryService.discoverPodsInNamespace();

    // Should include all pods when deployment name can't be extracted
    expect(result).toHaveLength(2);
    expect(result[0].podName).toBe("simple-pod");
    expect(result[1].podName).toBe("other-pod");

    expect(loggerService.info).toHaveBeenCalledWith({
      namespace,
      totalPods: 2,
      targetPods: 2,
      currentPodName: "simple-pod",
      message: "Pod discovery completed"
    });
  });

  it("should map pod to PodInfo correctly", async () => {
    const namespace = faker.internet.domainWord();
    const { podDiscoveryService, k8sClient } = setup({
      KUBERNETES_NAMESPACE_OVERRIDE: namespace
    });
    const podName = faker.internet.domainWord();
    const podRaw = seedKubernetesPodTestData({
      metadata: {
        name: podName,
        namespace,
        labels: { app: faker.internet.domainWord(), version: faker.system.semver() },
        annotations: { "kubernetes.io/created-by": faker.internet.domainWord() }
      },
      spec: {
        containers: [{ name: faker.internet.domainWord() }, { name: faker.internet.domainWord() }],
        nodeName: faker.internet.domainWord()
      },
      status: {
        phase: faker.helpers.arrayElement(["Running", "Pending", "Succeeded", "Failed", "Unknown"]),
        podIP: faker.internet.ip()
      }
    });

    k8sClient.listNamespacedPod.mockResolvedValue({ items: [podRaw] });

    const result = await podDiscoveryService.discoverPodsInNamespace();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      podName,
      namespace,
      status: podRaw.status?.phase,
      podIP: podRaw.status?.podIP,
      nodeName: podRaw.spec?.nodeName,
      labels: podRaw.metadata?.labels,
      annotations: podRaw.metadata?.annotations,
      containerNames: podRaw.spec?.containers.map(c => c.name)
    });
  });

  it("should handle pods with missing metadata gracefully", async () => {
    const namespace = faker.internet.domainWord();
    const { podDiscoveryService, k8sClient } = setup({
      KUBERNETES_NAMESPACE_OVERRIDE: namespace
    });
    const podName = faker.internet.domainWord();
    const podRaw = seedKubernetesPodTestData({
      metadata: {
        name: podName,
        namespace,
        labels: undefined,
        annotations: undefined
      },
      spec: {
        containers: [{ name: faker.internet.domainWord() }],
        nodeName: undefined
      },
      status: {
        phase: undefined,
        podIP: undefined
      }
    });

    k8sClient.listNamespacedPod.mockResolvedValue({ items: [podRaw] });

    const result = await podDiscoveryService.discoverPodsInNamespace();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      podName,
      namespace,
      status: undefined,
      podIP: undefined,
      nodeName: undefined,
      labels: {},
      annotations: {},
      containerNames: [podRaw.spec?.containers[0].name]
    });
  });

  it("should handle pods with missing container spec", async () => {
    const namespace = faker.internet.domainWord();
    const { podDiscoveryService, k8sClient } = setup({
      KUBERNETES_NAMESPACE_OVERRIDE: namespace
    });
    const podName = faker.internet.domainWord();
    const podRaw: V1Pod = {
      metadata: { name: podName },
      spec: undefined,
      status: undefined
    };

    k8sClient.listNamespacedPod.mockResolvedValue({ items: [podRaw] });

    const result = await podDiscoveryService.discoverPodsInNamespace();

    expect(result).toHaveLength(1);
    expect(result[0].containerNames).toEqual([]);
  });

  it("should log debug information for kubeconfig context", async () => {
    const { podDiscoveryService, kubeConfig, k8sClient } = setup();
    const currentContext = faker.internet.domainWord();
    const kubeconfigNamespace = faker.internet.domainWord();

    kubeConfig.getCurrentContext.mockReturnValue(currentContext);
    kubeConfig.getContextObject.mockReturnValue({
      name: currentContext,
      cluster: faker.internet.domainWord(),
      user: faker.internet.domainWord(),
      namespace: kubeconfigNamespace
    } as Context);
    k8sClient.listNamespacedPod.mockResolvedValue({ items: [] });

    await podDiscoveryService.discoverPodsInNamespace();

    expect(kubeConfig.getCurrentContext).toHaveBeenCalled();
    expect(kubeConfig.getContextObject).toHaveBeenCalledWith(currentContext);
  });

  it("should log namespace source when using kubeconfig", async () => {
    const { podDiscoveryService, kubeConfig, k8sClient, loggerService } = setup();
    const kubeconfigNamespace = faker.internet.domainWord();
    const currentContext = faker.internet.domainWord();

    kubeConfig.getCurrentContext.mockReturnValue(currentContext);
    kubeConfig.getContextObject.mockReturnValue({
      name: currentContext,
      cluster: faker.internet.domainWord(),
      user: faker.internet.domainWord(),
      namespace: kubeconfigNamespace
    } as Context);
    k8sClient.listNamespacedPod.mockResolvedValue({ items: [] });

    await podDiscoveryService.discoverPodsInNamespace();

    expect(loggerService.info).toHaveBeenCalledWith({
      namespace: kubeconfigNamespace,
      source: "kubeconfig"
    });
  });

  it("should use label selector when POD_LABEL_SELECTOR is configured", async () => {
    const namespace = faker.internet.domainWord();
    const labelSelector = "app=web,environment=production";
    const { podDiscoveryService, k8sClient } = setup({
      KUBERNETES_NAMESPACE_OVERRIDE: namespace,
      POD_LABEL_SELECTOR: labelSelector
    });

    k8sClient.listNamespacedPod.mockResolvedValue({ items: [] });

    await podDiscoveryService.discoverPodsInNamespace();

    expect(k8sClient.listNamespacedPod).toHaveBeenCalledWith({
      namespace,
      labelSelector
    });
  });

  function setup(envOverrides: Record<string, string> = {}) {
    container.clearInstances();

    const k8sClient = mock<CoreV1Api>();
    const kubeConfig = mock<KubeConfig>();

    const testEnv = {
      HOSTNAME: "log-collector-6bdb59678c-w9jww",
      KUBERNETES_NAMESPACE_OVERRIDE: "",
      POD_LABEL_SELECTOR: undefined,
      LOG_DIR: "./test-log",
      ...envOverrides
    };

    const config = new ConfigService(testEnv);
    const loggerService = mockProvider(LoggerService);

    const podDiscoveryService = new PodDiscoveryService(k8sClient, kubeConfig, config, loggerService);

    return {
      podDiscoveryService,
      k8sClient,
      kubeConfig,
      config,
      loggerService
    };
  }
});
