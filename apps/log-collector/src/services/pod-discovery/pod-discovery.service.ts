import { CoreV1Api, KubeConfig, V1Pod } from "@kubernetes/client-node";
import { setTimeout as delay } from "timers/promises";
import { singleton } from "tsyringe";

import { ConfigService } from "@src/services/config/config.service";
import { LoggerService } from "@src/services/logger/logger.service";

/**
 * Information about a Kubernetes pod for log collection
 */
export interface PodInfo {
  /** Name of the pod */
  podName: string;
  /** Kubernetes namespace the pod belongs to */
  namespace: string;
  /** Current phase/status of the pod (e.g., "Running", "Pending") */
  status?: string;
  /** IP address assigned to the pod */
  podIP?: string;
  /** Name of the node where the pod is scheduled */
  nodeName?: string;
  /** Kubernetes labels attached to the pod */
  labels: Record<string, string>;
  /** Kubernetes annotations attached to the pod */
  annotations: Record<string, string>;
  /** Names of all containers in the pod */
  containerNames: string[];
}

export type PodCallback = (podInfo: PodInfo, signal: AbortSignal) => void;

/**
 * Discovers Kubernetes pods in the current namespace for log collection
 *
 * This service handles:
 * - Discovering all pods in the current namespace
 * - Filtering out the current pod (to avoid self-collection)
 * - Mapping Kubernetes pod objects to simplified PodInfo structures
 * - Determining the current namespace from kubeconfig or environment
 * - Providing pod metadata needed for log collection
 * - Polling for pod changes and notifying via callbacks
 *
 * The service supports namespace override via environment variables
 * and automatically excludes the current pod from discovery to prevent
 * infinite log collection loops.
 */
@singleton()
export class PodDiscoveryService {
  private readonly controllers = new Map<string, { ac: AbortController; podInfo: PodInfo }>();

  private namespace?: string;

  /**
   * Creates a new PodDiscoveryService instance
   *
   * @param k8sClient - Kubernetes API client for pod operations
   * @param kubeConfig - Kubernetes configuration for context and namespace
   * @param config - Service for accessing configuration values
   * @param loggerService - Service for logging application events
   */
  constructor(
    private readonly k8sClient: CoreV1Api,
    private readonly kubeConfig: KubeConfig,
    private readonly config: ConfigService,
    private readonly loggerService: LoggerService
  ) {
    this.loggerService.setContext(PodDiscoveryService.name);
  }

  /**
   * Watches for pod changes and invokes callback for each discovered pod.
   *
   * Performs an initial discovery, then enters a polling loop to detect
   * pod additions and removals. The returned promise stays pending
   * indefinitely (same contract as the future watch-based implementation).
   *
   * @param callback - Called for each discovered pod with an AbortSignal that fires when the pod disappears
   */
  async watchPods(callback: PodCallback): Promise<void> {
    const pods = await this.discoverPodsInNamespace();

    for (const pod of pods) {
      this.trackPod(pod, callback);
    }

    await this.startPodWatch(callback);
  }

  /**
   * Enters a polling loop that periodically re-lists pods and reconciles
   * additions/removals against the tracked set. Never resolves normally.
   *
   * @param callback - Forwarded to trackPod for newly discovered pods
   */
  private async startPodWatch(callback: PodCallback): Promise<void> {
    const pollInterval = this.config.get("POD_POLL_INTERVAL_MS");
    const ALWAYS_TRUE_TO_RUN_INDEFINITELY = true;

    while (ALWAYS_TRUE_TO_RUN_INDEFINITELY) {
      await delay(pollInterval);

      try {
        const currentPods = await this.discoverPodsInNamespace();
        const currentPodNames = new Set(currentPods.map(p => p.podName));

        for (const pod of currentPods) {
          if (!this.controllers.has(pod.podName)) {
            this.trackPod(pod, callback);
          }
        }

        for (const [podName, { podInfo }] of this.controllers) {
          if (!currentPodNames.has(podName)) {
            this.untrackPod(podInfo);
          }
        }
      } catch (error) {
        this.loggerService.error({
          event: "POD_POLL_ERROR",
          error
        });
      }
    }
  }

  /**
   * Discovers all pods in the current namespace, excluding the current pod
   *
   * @returns Promise that resolves to an array of PodInfo objects for discovered pods
   * @throws Error if namespace cannot be determined or Kubernetes API calls fail
   */
  async discoverPodsInNamespace(): Promise<PodInfo[]> {
    const namespace = this.getCurrentNamespace();

    this.loggerService.info({ event: "POD_DISCOVERY_STARTED", namespace });

    const { items: podsRaw } = await this.k8sClient.listNamespacedPod({
      namespace,
      labelSelector: this.config.get("POD_LABEL_SELECTOR")
    });

    const currentPodName = this.config.get("HOSTNAME");
    const pods = podsRaw.filter(pod => this.isPodReady(pod)).map(pod => this.mapPodToInfo(pod, namespace));

    const targetPods = this.filterOutPodsFromSameDeployment(pods, currentPodName);

    this.loggerService.info({
      event: "POD_DISCOVERY_COMPLETED",
      namespace,
      totalPods: podsRaw.length,
      readyPods: pods.length,
      targetPods: targetPods.length,
      currentPodName
    });

    return targetPods;
  }

  /**
   * Starts tracking a pod by creating an AbortController and invoking the callback.
   *
   * @param podInfo - The pod to track
   * @param callback - Called with the pod info and an AbortSignal tied to this pod's lifecycle
   */
  private trackPod(podInfo: PodInfo, callback: PodCallback): void {
    const ac = new AbortController();
    this.controllers.set(podInfo.podName, { ac, podInfo });
    this.loggerService.info({
      event: "POD_READY",
      podName: podInfo.podName,
      namespace: podInfo.namespace
    });
    callback(podInfo, ac.signal);
  }

  /**
   * Stops tracking a pod by aborting its signal and removing it from the map.
   *
   * @param podInfo - The pod to untrack
   */
  private untrackPod(podInfo: PodInfo): void {
    const entry = this.controllers.get(podInfo.podName);
    if (entry) {
      this.loggerService.info({
        event: "POD_DELETED",
        podName: podInfo.podName,
        namespace: podInfo.namespace
      });
      entry.ac.abort();
      this.controllers.delete(podInfo.podName);
    }
  }

  /**
   * Checks if a pod has a Ready condition set to True.
   */
  private isPodReady(pod: V1Pod): boolean {
    return pod.status?.conditions?.some(c => c.type === "Ready" && c.status === "True") ?? false;
  }

  /**
   * Checks whether a pod name belongs to the same deployment as the current pod.
   *
   * @param podName - Name of the pod to check
   * @param currentPodName - Name of the current pod
   * @returns true if the pod belongs to the same deployment
   */
  private isPodFromSameDeployment(podName: string, currentPodName: string): boolean {
    const currentParts = currentPodName.split("-");
    if (currentParts.length < 3) return false;
    const currentDeployment = currentParts.slice(0, -2).join("-");

    const podParts = podName.split("-");
    if (podParts.length < 3) return false;
    const podDeployment = podParts.slice(0, -2).join("-");

    return podDeployment === currentDeployment;
  }

  /**
   * Filters out all pods from the same deployment as the current pod.
   *
   * @param pods - Array of discovered pods
   * @param currentPodName - Name of the current pod
   * @returns Array of pods excluding all pods from the same deployment
   */
  private filterOutPodsFromSameDeployment(pods: PodInfo[], currentPodName: string): PodInfo[] {
    return pods.filter(pod => !this.isPodFromSameDeployment(pod.podName, currentPodName));
  }

  /**
   * Determines the current namespace for pod discovery
   *
   * Uses a cached value if available, then checks for a namespace override
   * in configuration, and falls back to extracting the namespace from
   * the current Kubernetes context.
   *
   * @returns The namespace to discover pods in
   * @throws Error if namespace cannot be determined from config or kubeconfig
   */
  private getCurrentNamespace(): string {
    if (this.namespace) {
      return this.namespace;
    }

    const overrideNamespace = this.config.get("KUBERNETES_NAMESPACE_OVERRIDE");
    if (overrideNamespace) {
      this.namespace = overrideNamespace;
      return this.namespace;
    }

    this.namespace = this.getNamespaceFromKubeConfig();
    return this.namespace;
  }

  /**
   * Extracts the namespace from the current Kubernetes context
   *
   * Gets the current context from kubeconfig and extracts the namespace
   * from the context object. This is used when no namespace override
   * is provided in configuration.
   *
   * @returns The namespace from the current kubeconfig context
   * @throws Error if current context is not found or has no namespace
   */
  private getNamespaceFromKubeConfig(): string {
    const currentContext = this.kubeConfig.getCurrentContext();
    this.loggerService.debug({ event: "KUBE_CONFIG_CONTEXT", currentContext });

    const context = this.kubeConfig.getContextObject(currentContext);
    this.loggerService.debug({ event: "KUBE_CONFIG_CONTEXT_OBJECT", context });

    if (!context) {
      throw new Error(`Context object not found for current context: ${currentContext}`);
    }

    const namespace = context.namespace;

    if (!namespace) {
      throw new Error(`No namespace provided in k8s context: ${currentContext}. Please set namespace in context or provide KUBERNETES_NAMESPACE_OVERRIDE`);
    }

    this.loggerService.info({ event: "NAMESPACE_RESOLVED", namespace, source: "kubeconfig" });

    return namespace;
  }

  /**
   * Maps a Kubernetes V1Pod object to a simplified PodInfo structure
   *
   * @param pod - The raw Kubernetes pod object
   * @param namespace - The namespace the pod belongs to
   * @returns A PodInfo object with extracted pod information
   */
  private mapPodToInfo(pod: V1Pod, namespace: string): PodInfo {
    return {
      podName: pod.metadata?.name || "",
      namespace: namespace,
      status: pod.status?.phase,
      podIP: pod.status?.podIP,
      nodeName: pod.spec?.nodeName,
      labels: pod.metadata?.labels || {},
      annotations: pod.metadata?.annotations || {},
      containerNames: pod.spec?.containers?.map(container => container.name) ?? []
    };
  }
}
