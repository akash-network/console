import { faker } from "@faker-js/faker";
import type { Context, CoreV1Api, KubeConfig, V1Pod, Watch } from "@kubernetes/client-node";
import { container } from "tsyringe";
import { mock } from "vitest-mock-extended";

import { ConfigService } from "@src/services/config/config.service";
import { ErrorHandlerService } from "@src/services/error-handler/error-handler.service";
import { LoggerService } from "@src/services/logger/logger.service";
import type { PodCallback } from "./pod-discovery.service";
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
        spec: { containers: [{ name: "app" }, { name: "sidecar" }] },
        status: { phase: "Running", conditions: [{ type: "Ready", status: "True" }] }
      }),
      seedKubernetesPodTestData({
        metadata: { name: "api-abc123-def456", namespace },
        spec: { containers: [{ name: "nginx" }] },
        status: { phase: "Running", conditions: [{ type: "Ready", status: "True" }] }
      }),
      seedKubernetesPodTestData({
        metadata: { name: currentPodName, namespace },
        spec: { containers: [{ name: "collector" }] },
        status: { phase: "Running", conditions: [{ type: "Ready", status: "True" }] }
      }),
      seedKubernetesPodTestData({
        metadata: { name: "log-collector-c5f7d6bc5-d8nrl", namespace },
        spec: { containers: [{ name: "collector" }] },
        status: { phase: "Running", conditions: [{ type: "Ready", status: "True" }] }
      }),
      seedKubernetesPodTestData({
        metadata: { name: "log-collector-xyz789-abc123", namespace },
        spec: { containers: [{ name: "collector" }] },
        status: { phase: "Running", conditions: [{ type: "Ready", status: "True" }] }
      })
    ];

    k8sClient.listNamespacedPod.mockResolvedValue({ items: podsRaw });

    const { pods: result } = await podDiscoveryService.discoverPodsInNamespace();

    expect(result).toHaveLength(2);
    expect(result[0].podName).toBe("web-78d5c9c5b-hxqxs");
    expect(result[1].podName).toBe("api-abc123-def456");

    expect(result.find(pod => pod.podName === currentPodName)).toBeUndefined();
    expect(result.find(pod => pod.podName === "log-collector-c5f7d6bc5-d8nrl")).toBeUndefined();
    expect(result.find(pod => pod.podName === "log-collector-xyz789-abc123")).toBeUndefined();

    expect(k8sClient.listNamespacedPod).toHaveBeenCalledWith({ namespace, labelSelector: undefined });
    expect(loggerService.debug).toHaveBeenCalledWith({ event: "POD_DISCOVERY_STARTED", namespace });
    expect(loggerService.debug).toHaveBeenCalledWith({
      event: "POD_DISCOVERY_COMPLETED",
      namespace,
      totalPods: 5,
      readyPods: 5,
      targetPods: 2,
      currentPodName
    });
  });

  it("should filter out pods that are not ready", async () => {
    const namespace = faker.internet.domainWord();
    const { podDiscoveryService, k8sClient } = setup({ KUBERNETES_NAMESPACE_OVERRIDE: namespace });

    const podsRaw = [
      seedKubernetesPodTestData({
        metadata: { name: "ready-pod", namespace },
        spec: { containers: [{ name: "app" }] },
        status: { phase: "Running", conditions: [{ type: "Ready", status: "True" }] }
      }),
      seedKubernetesPodTestData({
        metadata: { name: "not-ready-pod", namespace },
        spec: { containers: [{ name: "app" }] },
        status: { phase: "Pending", conditions: [{ type: "Ready", status: "False" }] }
      }),
      seedKubernetesPodTestData({
        metadata: { name: "no-conditions-pod", namespace },
        spec: { containers: [{ name: "app" }] },
        status: { phase: "Pending" }
      })
    ];

    k8sClient.listNamespacedPod.mockResolvedValue({ items: podsRaw });

    const { pods: result } = await podDiscoveryService.discoverPodsInNamespace();

    expect(result).toHaveLength(1);
    expect(result[0].podName).toBe("ready-pod");
  });

  it("should use namespace override when provided", async () => {
    const overrideNamespace = faker.internet.domainWord();
    const { podDiscoveryService, k8sClient } = setup({ KUBERNETES_NAMESPACE_OVERRIDE: overrideNamespace });

    k8sClient.listNamespacedPod.mockResolvedValue({ items: [] });
    await podDiscoveryService.discoverPodsInNamespace();

    expect(k8sClient.listNamespacedPod).toHaveBeenCalledWith({ namespace: overrideNamespace, labelSelector: undefined });
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

    expect(k8sClient.listNamespacedPod).toHaveBeenCalledWith({ namespace: kubeconfigNamespace, labelSelector: undefined });
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
    kubeConfig.getContextObject.mockReturnValue({ name: currentContext, cluster: "c", user: "u", namespace: undefined } as Context);

    await expect(podDiscoveryService.discoverPodsInNamespace()).rejects.toThrow("No namespace provided");
  });

  it("should handle empty pod list", async () => {
    const namespace = faker.internet.domainWord();
    const { podDiscoveryService, k8sClient, loggerService } = setup({ KUBERNETES_NAMESPACE_OVERRIDE: namespace });

    k8sClient.listNamespacedPod.mockResolvedValue({ items: [] });
    const { pods: result } = await podDiscoveryService.discoverPodsInNamespace();

    expect(result).toHaveLength(0);
    expect(loggerService.debug).toHaveBeenCalledWith(expect.objectContaining({ event: "POD_DISCOVERY_COMPLETED", targetPods: 0 }));
  });

  it("should handle pod names with insufficient parts for deployment extraction", async () => {
    const namespace = faker.internet.domainWord();
    const { podDiscoveryService, k8sClient } = setup({ KUBERNETES_NAMESPACE_OVERRIDE: namespace, HOSTNAME: "simple-pod" });

    k8sClient.listNamespacedPod.mockResolvedValue({
      items: [
        seedKubernetesPodTestData({
          metadata: { name: "simple-pod", namespace },
          spec: { containers: [{ name: "app" }] },
          status: { phase: "Running", conditions: [{ type: "Ready", status: "True" }] }
        }),
        seedKubernetesPodTestData({
          metadata: { name: "other-pod", namespace },
          spec: { containers: [{ name: "nginx" }] },
          status: { phase: "Running", conditions: [{ type: "Ready", status: "True" }] }
        })
      ]
    });

    const { pods: result } = await podDiscoveryService.discoverPodsInNamespace();
    expect(result).toHaveLength(1);
    expect(result[0].podName).toBe("other-pod");
  });

  it("should map pod to PodInfo correctly", async () => {
    const namespace = faker.internet.domainWord();
    const { podDiscoveryService, k8sClient } = setup({ KUBERNETES_NAMESPACE_OVERRIDE: namespace });
    const podName = faker.internet.domainWord();
    const podRaw = seedKubernetesPodTestData({
      metadata: { name: podName, namespace, labels: { app: "web" }, annotations: { note: "test" } },
      spec: { containers: [{ name: "app" }, { name: "sidecar" }], nodeName: "node-1" },
      status: { phase: "Running", podIP: "10.0.0.1", conditions: [{ type: "Ready", status: "True" }] }
    });

    k8sClient.listNamespacedPod.mockResolvedValue({ items: [podRaw] });
    const { pods: result } = await podDiscoveryService.discoverPodsInNamespace();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      podName,
      namespace,
      status: "Running",
      podIP: "10.0.0.1",
      nodeName: "node-1",
      labels: { app: "web" },
      annotations: { note: "test" },
      containerNames: ["app", "sidecar"]
    });
  });

  it("should handle pods with missing metadata gracefully", async () => {
    const namespace = faker.internet.domainWord();
    const { podDiscoveryService, k8sClient } = setup({ KUBERNETES_NAMESPACE_OVERRIDE: namespace });
    const podName = faker.internet.domainWord();
    const podRaw = seedKubernetesPodTestData({
      metadata: { name: podName, namespace, labels: undefined, annotations: undefined },
      spec: { containers: [{ name: "app" }], nodeName: undefined },
      status: { phase: undefined, podIP: undefined, conditions: [{ type: "Ready", status: "True" }] }
    });

    k8sClient.listNamespacedPod.mockResolvedValue({ items: [podRaw] });
    const { pods: result } = await podDiscoveryService.discoverPodsInNamespace();

    expect(result[0]).toEqual(expect.objectContaining({ podName, labels: {}, annotations: {} }));
  });

  it("should handle pods with missing container spec", async () => {
    const namespace = faker.internet.domainWord();
    const { podDiscoveryService, k8sClient } = setup({ KUBERNETES_NAMESPACE_OVERRIDE: namespace });
    const podRaw: V1Pod = { metadata: { name: faker.internet.domainWord() }, spec: undefined, status: { conditions: [{ type: "Ready", status: "True" }] } };

    k8sClient.listNamespacedPod.mockResolvedValue({ items: [podRaw] });
    const { pods: result } = await podDiscoveryService.discoverPodsInNamespace();

    expect(result[0].containerNames).toEqual([]);
  });

  it("should use label selector when POD_LABEL_SELECTOR is configured", async () => {
    const namespace = faker.internet.domainWord();
    const labelSelector = "app=web";
    const { podDiscoveryService, k8sClient } = setup({ KUBERNETES_NAMESPACE_OVERRIDE: namespace, POD_LABEL_SELECTOR: labelSelector });

    k8sClient.listNamespacedPod.mockResolvedValue({ items: [] });
    await podDiscoveryService.discoverPodsInNamespace();

    expect(k8sClient.listNamespacedPod).toHaveBeenCalledWith({ namespace, labelSelector });
  });

  describe("watchPods — K8s Watch", () => {
    it("should track initially discovered pods and start K8s watch", async () => {
      const namespace = faker.internet.domainWord();
      const { podDiscoveryService, k8sClient, watch } = setup({ KUBERNETES_NAMESPACE_OVERRIDE: namespace });

      const pod = seedKubernetesPodTestData({
        metadata: { name: "pod-1", namespace },
        spec: { containers: [{ name: "app" }] },
        status: { phase: "Running", conditions: [{ type: "Ready", status: "True" }] }
      });

      k8sClient.listNamespacedPod.mockResolvedValue({ items: [pod] });
      watch.watch.mockResolvedValue(new AbortController());

      const callback = vi.fn();
      podDiscoveryService.watchPods(callback).catch(() => {});
      await flushPromises();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ podName: "pod-1" }), expect.any(AbortSignal));
      expect(watch.watch).toHaveBeenCalledWith(`/api/v1/namespaces/${namespace}/pods`, expect.any(Object), expect.any(Function), expect.any(Function));
    });

    it("should track new ready pod on ADDED watch event", async () => {
      const namespace = faker.internet.domainWord();
      const { podDiscoveryService, k8sClient, watch } = setup({ KUBERNETES_NAMESPACE_OVERRIDE: namespace });

      k8sClient.listNamespacedPod.mockResolvedValue({ items: [] });

      let eventCb: (phase: string, apiObj: V1Pod) => void = () => {};
      watch.watch.mockImplementation(async (_path, _params, cb) => {
        eventCb = cb;
        return new AbortController();
      });

      const callback = vi.fn();
      podDiscoveryService.watchPods(callback).catch(() => {});
      await flushPromises();

      eventCb(
        "ADDED",
        seedKubernetesPodTestData({
          metadata: { name: "new-pod", namespace },
          spec: { containers: [{ name: "app" }] },
          status: { conditions: [{ type: "Ready", status: "True" }] }
        })
      );
      await flushPromises();

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ podName: "new-pod" }), expect.any(AbortSignal));
    });

    it("should skip ADDED events for not-ready pods", async () => {
      const namespace = faker.internet.domainWord();
      const { podDiscoveryService, k8sClient, watch } = setup({ KUBERNETES_NAMESPACE_OVERRIDE: namespace });

      k8sClient.listNamespacedPod.mockResolvedValue({ items: [] });

      let eventCb: (phase: string, apiObj: V1Pod) => void = () => {};
      watch.watch.mockImplementation(async (_path, _params, cb) => {
        eventCb = cb;
        return new AbortController();
      });

      const callback = vi.fn();
      podDiscoveryService.watchPods(callback).catch(() => {});
      await flushPromises();

      eventCb(
        "ADDED",
        seedKubernetesPodTestData({
          metadata: { name: "not-ready", namespace },
          spec: { containers: [{ name: "app" }] },
          status: { conditions: [{ type: "Ready", status: "False" }] }
        })
      );

      expect(callback).not.toHaveBeenCalled();
    });

    it("should abort signal on DELETED watch event", async () => {
      const namespace = faker.internet.domainWord();
      const { podDiscoveryService, k8sClient, watch, loggerService } = setup({ KUBERNETES_NAMESPACE_OVERRIDE: namespace });

      const pod = seedKubernetesPodTestData({
        metadata: { name: "web-abc", namespace },
        spec: { containers: [{ name: "app" }] },
        status: { phase: "Running", conditions: [{ type: "Ready", status: "True" }] }
      });
      k8sClient.listNamespacedPod.mockResolvedValue({ items: [pod] });

      let eventCb: (phase: string, apiObj: V1Pod) => void = () => {};
      watch.watch.mockImplementation(async (_path, _params, cb) => {
        eventCb = cb;
        return new AbortController();
      });

      let capturedSignal: AbortSignal | undefined;
      const callback: PodCallback = vi.fn((_p, signal) => {
        capturedSignal = signal;
      });

      podDiscoveryService.watchPods(callback).catch(() => {});
      await flushPromises();

      expect(capturedSignal!.aborted).toBe(false);
      eventCb("DELETED", pod);
      await flushPromises();
      expect(capturedSignal!.aborted).toBe(true);
      expect(loggerService.info).toHaveBeenCalledWith(expect.objectContaining({ event: "POD_DELETED", podName: "web-abc" }));
    });

    it("should skip already-tracked pods", async () => {
      const namespace = faker.internet.domainWord();
      const { podDiscoveryService, k8sClient, watch } = setup({ KUBERNETES_NAMESPACE_OVERRIDE: namespace });

      const pod = seedKubernetesPodTestData({
        metadata: { name: "pod-1", namespace },
        spec: { containers: [{ name: "app" }] },
        status: { phase: "Running", conditions: [{ type: "Ready", status: "True" }] }
      });
      k8sClient.listNamespacedPod.mockResolvedValue({ items: [pod, pod] });
      watch.watch.mockResolvedValue(new AbortController());

      const callback = vi.fn();
      podDiscoveryService.watchPods(callback).catch(() => {});
      await flushPromises();

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should filter same-deployment pods in watch events", async () => {
      const namespace = faker.internet.domainWord();
      const { podDiscoveryService, k8sClient, watch } = setup({ KUBERNETES_NAMESPACE_OVERRIDE: namespace });

      k8sClient.listNamespacedPod.mockResolvedValue({ items: [] });

      let eventCb: (phase: string, apiObj: V1Pod) => void = () => {};
      watch.watch.mockImplementation(async (_path, _params, cb) => {
        eventCb = cb;
        return new AbortController();
      });

      const callback = vi.fn();
      podDiscoveryService.watchPods(callback).catch(() => {});
      await flushPromises();

      eventCb(
        "ADDED",
        seedKubernetesPodTestData({
          metadata: { name: "log-collector-abc123-def456", namespace },
          spec: { containers: [{ name: "c" }] },
          status: { conditions: [{ type: "Ready", status: "True" }] }
        })
      );

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("watchPods — fallback to polling", () => {
    it("should fall back to polling permanently on 403", async () => {
      const namespace = faker.internet.domainWord();
      const { podDiscoveryService, k8sClient, watch, loggerService } = setup({
        KUBERNETES_NAMESPACE_OVERRIDE: namespace,
        POD_POLL_INTERVAL_MS: "100"
      });

      k8sClient.listNamespacedPod.mockResolvedValue({ items: [] });

      let doneCb: (err?: unknown) => void = () => {};
      watch.watch.mockImplementation(async (_path, _params, _cb, done) => {
        doneCb = done;
        return new AbortController();
      });

      podDiscoveryService.watchPods(vi.fn()).catch(() => {});
      await flushPromises();

      doneCb(Object.assign(new Error("Forbidden"), { statusCode: 403 }));
      await flushPromises();

      expect(loggerService.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "POD_WATCH_FORBIDDEN" }));
      // Now polling — it will call listNamespacedPod after interval
    });

    it("should fall back to polling then retry watch on non-403 failure", async () => {
      const originalTimeout = AbortSignal.timeout;
      AbortSignal.timeout = (ms: number) => originalTimeout(Math.min(ms, 200));

      try {
        const namespace = faker.internet.domainWord();
        const { podDiscoveryService, k8sClient, watch, loggerService } = setup({
          KUBERNETES_NAMESPACE_OVERRIDE: namespace,
          POD_POLL_INTERVAL_MS: "100"
        });

        k8sClient.listNamespacedPod.mockResolvedValue({ items: [] });

        let watchCallCount = 0;
        watch.watch.mockImplementation(async () => {
          watchCallCount++;
          throw new Error("connection refused");
        });

        podDiscoveryService.watchPods(vi.fn()).catch(() => {});

        // First watch attempt fails immediately, falls back to polling
        await vi.waitFor(() => {
          expect(loggerService.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "POD_WATCH_FAILED_FALLBACK_TO_POLLING" }));
        });

        // After WATCH_RETRY_INTERVAL_MS (capped to 200ms), watch is retried
        await vi.waitFor(() => expect(watchCallCount).toBeGreaterThanOrEqual(2));
      } finally {
        AbortSignal.timeout = originalTimeout;
      }
    });

    it("should detect new pods on polling", async () => {
      const namespace = faker.internet.domainWord();
      const { podDiscoveryService, k8sClient, watch } = setup({
        KUBERNETES_NAMESPACE_OVERRIDE: namespace,
        POD_POLL_INTERVAL_MS: "100"
      });

      let doneCb: (err?: unknown) => void = () => {};
      watch.watch.mockImplementation(async (_path, _params, _cb, done) => {
        doneCb = done;
        return new AbortController();
      });

      const pod1 = seedKubernetesPodTestData({
        metadata: { name: "pod-1", namespace },
        spec: { containers: [{ name: "app" }] },
        status: { phase: "Running", conditions: [{ type: "Ready", status: "True" }] }
      });
      const pod2 = seedKubernetesPodTestData({
        metadata: { name: "pod-2", namespace },
        spec: { containers: [{ name: "app" }] },
        status: { phase: "Running", conditions: [{ type: "Ready", status: "True" }] }
      });

      let callCount = 0;
      k8sClient.listNamespacedPod.mockImplementation(async () => {
        callCount++;
        if (callCount <= 1) return { items: [pod1] };
        if (callCount === 2) return { items: [pod1, pod2] };
        return new Promise(() => {});
      });

      const callback = vi.fn();
      podDiscoveryService.watchPods(callback).catch(() => {});
      await flushPromises();

      doneCb(Object.assign(new Error("Forbidden"), { statusCode: 403 }));

      await vi.waitFor(() => expect(callback).toHaveBeenCalledTimes(2));
      expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({ podName: "pod-2" }), expect.any(AbortSignal));
    });

    it("should abort signal for removed pods on polling", async () => {
      const namespace = faker.internet.domainWord();
      const { podDiscoveryService, k8sClient, watch, loggerService } = setup({
        KUBERNETES_NAMESPACE_OVERRIDE: namespace,
        POD_POLL_INTERVAL_MS: "100"
      });

      let doneCb: (err?: unknown) => void = () => {};
      watch.watch.mockImplementation(async (_path, _params, _cb, done) => {
        doneCb = done;
        return new AbortController();
      });

      const pod1 = seedKubernetesPodTestData({
        metadata: { name: "pod-1", namespace },
        spec: { containers: [{ name: "app" }] },
        status: { phase: "Running", conditions: [{ type: "Ready", status: "True" }] }
      });
      const pod2 = seedKubernetesPodTestData({
        metadata: { name: "pod-2", namespace },
        spec: { containers: [{ name: "app" }] },
        status: { phase: "Running", conditions: [{ type: "Ready", status: "True" }] }
      });

      let callCount = 0;
      k8sClient.listNamespacedPod.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) return { items: [pod1, pod2] };
        if (callCount === 2) return { items: [pod1] };
        return new Promise(() => {});
      });

      const signals: AbortSignal[] = [];
      const callback: PodCallback = vi.fn((_p, signal) => {
        signals.push(signal);
      });

      podDiscoveryService.watchPods(callback).catch(() => {});
      await flushPromises();

      doneCb(Object.assign(new Error("Forbidden"), { statusCode: 403 }));

      await vi.waitFor(() => expect(signals).toHaveLength(2));
      await vi.waitFor(() => expect(signals[1].aborted).toBe(true));
      expect(loggerService.info).toHaveBeenCalledWith(expect.objectContaining({ event: "POD_DELETED", podName: "pod-2" }));
    });

    it("should throw AggregateError after 3 consecutive poll failures including watch errors", async () => {
      const namespace = faker.internet.domainWord();
      const { podDiscoveryService, k8sClient, watch } = setup({
        KUBERNETES_NAMESPACE_OVERRIDE: namespace,
        POD_POLL_INTERVAL_MS: "100"
      });

      let doneCb: (err?: unknown) => void = () => {};
      watch.watch.mockImplementation(async (_path, _params, _cb, done) => {
        doneCb = done;
        return new AbortController();
      });

      let callCount = 0;
      k8sClient.listNamespacedPod.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) return { items: [] };
        throw new Error("K8s API unavailable");
      });

      const promise = podDiscoveryService.watchPods(vi.fn());
      await flushPromises();

      doneCb(Object.assign(new Error("Forbidden"), { statusCode: 403 }));

      await expect(promise).rejects.toThrow("Pod polling failed 3 times consecutively");
    });

    it("should reset consecutive error count on successful poll", async () => {
      const namespace = faker.internet.domainWord();
      const { podDiscoveryService, k8sClient, watch, loggerService } = setup({
        KUBERNETES_NAMESPACE_OVERRIDE: namespace,
        POD_POLL_INTERVAL_MS: "100"
      });

      let doneCb: (err?: unknown) => void = () => {};
      watch.watch.mockImplementation(async (_path, _params, _cb, done) => {
        doneCb = done;
        return new AbortController();
      });

      const pollError = new Error("K8s API unavailable");
      let callCount = 0;
      k8sClient.listNamespacedPod.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) return { items: [] };
        if (callCount <= 3) throw pollError;
        if (callCount === 4) return { items: [] };
        if (callCount <= 6) throw pollError;
        if (callCount === 7) return { items: [] };
        throw pollError;
      });

      const promise = podDiscoveryService.watchPods(vi.fn());
      await flushPromises();

      doneCb(Object.assign(new Error("Forbidden"), { statusCode: 403 }));

      await expect(promise).rejects.toThrow("Pod polling failed 3 times consecutively");
      expect(loggerService.error).toHaveBeenCalledTimes(7);
    });
  });

  function setup(envOverrides: Record<string, string> = {}) {
    container.clearInstances();

    const k8sClient = mock<CoreV1Api>();
    const kubeConfig = mock<KubeConfig>();
    const watch = mock<Watch>();
    const errorHandlerService = new ErrorHandlerService();

    const testEnv = {
      HOSTNAME: "log-collector-6bdb59678c-w9jww",
      KUBERNETES_NAMESPACE_OVERRIDE: "",
      POD_LABEL_SELECTOR: undefined,
      LOG_DIR: "./test-log",
      ...envOverrides
    };

    const config = new ConfigService(testEnv);
    const loggerService = mockProvider(LoggerService);

    const podDiscoveryService = new PodDiscoveryService(k8sClient, kubeConfig, config, loggerService, errorHandlerService, watch);

    return { podDiscoveryService, k8sClient, kubeConfig, config, loggerService, watch, errorHandlerService };
  }
});

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
