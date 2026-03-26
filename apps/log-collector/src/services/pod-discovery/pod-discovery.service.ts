import { CoreV1Api, KubeConfig, V1Pod, Watch } from "@kubernetes/client-node";
import { setTimeout as delay } from "timers/promises";
import { singleton } from "tsyringe";

import { AsyncChannel } from "@src/lib/async-channel/async-channel";
import { ConfigService } from "@src/services/config/config.service";
import { ErrorHandlerService } from "@src/services/error-handler/error-handler.service";
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

/** A pod lifecycle event yielded by the event stream generators. */
type PodEvent = { type: "added"; podInfo: PodInfo } | { type: "deleted"; podName: string };

/**
 * Discovers Kubernetes pods in the current namespace for log collection
 *
 * This service handles:
 * - Discovering all pods in the current namespace
 * - Filtering out the current pod (to avoid self-collection)
 * - Mapping Kubernetes pod objects to simplified PodInfo structures
 * - Determining the current namespace from kubeconfig or environment
 * - Providing pod metadata needed for log collection
 * - Watching for pod changes via K8s Watch API with polling fallback
 *
 * The watch → fallback → retry logic is expressed as composable generators:
 *
 *   podEventStream()           — orchestrator: try watch, fall back, retry
 *     ├── watchEvents()        — yields pod events from K8s Watch API
 *     └── pollEvents(signal?)  — yields pod events from periodic listing
 *
 * The service consumes `for await (const event of podEventStream())` and
 * manages tracking state. This cleanly separates event production (generators)
 * from event consumption (trackPod/untrackPod).
 *
 * The service supports namespace override via environment variables
 * and automatically excludes the current pod from discovery to prevent
 * infinite log collection loops.
 */
@singleton()
export class PodDiscoveryService {
  private readonly WATCH_RETRY_INTERVAL_MS = 30_000;

  private readonly MAX_POLL_FAILURES = 3;

  private readonly controllers = new Map<string, { ac: AbortController; podInfo: PodInfo }>();

  private namespace?: string;

  /**
   * Creates a new PodDiscoveryService instance
   *
   * @param k8sClient - Kubernetes API client for pod operations
   * @param kubeConfig - Kubernetes configuration for context and namespace
   * @param config - Service for accessing configuration values
   * @param loggerService - Service for logging application events
   * @param errorHandlerService - Service for classifying errors (e.g. 403 detection)
   * @param watch - Kubernetes Watch client for real-time pod events
   */
  constructor(
    private readonly k8sClient: CoreV1Api,
    private readonly kubeConfig: KubeConfig,
    private readonly config: ConfigService,
    private readonly loggerService: LoggerService,
    private readonly errorHandlerService: ErrorHandlerService,
    private readonly watch: Watch
  ) {
    this.loggerService.setContext(PodDiscoveryService.name);
  }

  /**
   * Watches for pod changes and invokes callback for each discovered pod.
   *
   * Performs an initial discovery, then consumes the pod event stream to track
   * lifecycle changes. Never resolves under normal operation.
   *
   * @param callback - Called for each discovered pod with an AbortSignal that fires when the pod disappears
   */
  async watchPods(callback: PodCallback): Promise<void> {
    const { pods, resourceVersion } = await this.discoverPodsInNamespace();

    for (const pod of pods) {
      this.trackPod(pod, callback);
    }

    for await (const event of this.podEventStream(resourceVersion)) {
      if (event.type === "added") {
        this.trackPod(event.podInfo, callback);
      } else {
        this.untrackPod(event.podName);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Event stream generators
  // ---------------------------------------------------------------------------

  /**
   * Top-level orchestrator generator.
   * - Tries K8s watch. If it connects and later ends, reconnects immediately.
   * - On 403, yields from permanent polling.
   * - On other errors, yields from timed polling, then retries watch.
   *
   * Threads resourceVersion from initial list → watch → polling → next watch
   * to avoid missing events between transitions. Resets accumulated watch
   * errors after a successful watch connection.
   *
   * @param initialResourceVersion - resourceVersion from the initial pod list, used for the first watch
   */
  private async *podEventStream(initialResourceVersion?: string): AsyncGenerator<PodEvent> {
    const watchErrors: Error[] = [];
    let resourceVersion = initialResourceVersion;

    const ALWAYS_RETRY = true;
    while (ALWAYS_RETRY) {
      try {
        yield* this.watchEvents(resourceVersion);
        watchErrors.length = 0;
      } catch (error) {
        if (this.errorHandlerService.isForbidden(error)) {
          this.loggerService.warn({
            event: "POD_WATCH_FORBIDDEN",
            message: 'Pod watch is forbidden. Ensure the SDL includes permissions: { read: ["logs", "events"] }'
          });
          yield* this.pollEvents();
          return;
        }

        watchErrors.push(error instanceof Error ? error : new Error(String(error)));
        this.loggerService.warn({ event: "POD_WATCH_FAILED_FALLBACK_TO_POLLING", error });

        try {
          resourceVersion = yield* this.pollEvents(AbortSignal.timeout(this.WATCH_RETRY_INTERVAL_MS));
        } catch (pollError) {
          if (pollError instanceof AggregateError && watchErrors.length > 0) {
            throw new AggregateError([...watchErrors, ...pollError.errors], pollError.message);
          }
          throw pollError;
        }
      }
    }
  }

  /**
   * Yields pod events from the K8s Watch API until the watch stream ends.
   * Throws on 403 or if the watch setup itself fails.
   *
   * @param resourceVersion - If provided, watch starts after this version to avoid replaying known events
   */
  private async *watchEvents(resourceVersion?: string): AsyncGenerator<PodEvent> {
    const namespace = this.getCurrentNamespace();
    const labelSelector = this.config.get("POD_LABEL_SELECTOR");
    const path = `/api/v1/namespaces/${namespace}/pods`;
    const channel = new AsyncChannel<PodEvent>();

    let doneError: unknown;
    let isDone = false;

    await this.watch
      .watch(
        path,
        { labelSelector, resourceVersion },
        (phase: string, apiObj: V1Pod) => {
          if (phase === "DELETED") {
            const podName = apiObj.metadata?.name;
            if (podName && this.controllers.has(podName)) {
              channel.push({ type: "deleted", podName });
            }
            return;
          }

          const podInfo = this.processPod(apiObj);
          if (!podInfo) return;

          if ((phase === "ADDED" || phase === "MODIFIED") && !this.controllers.has(podInfo.podName)) {
            channel.push({ type: "added", podInfo });
          }
        },
        (err?: unknown) => {
          isDone = true;
          doneError = err;
          channel.close();
        }
      )
      .then(() => {
        if (!isDone) {
          this.loggerService.info({ event: "POD_WATCH_ESTABLISHED", path, labelSelector });
        }
      });

    yield* channel;

    if (doneError) {
      throw doneError;
    }

    this.loggerService.info({ event: "POD_WATCH_ENDED", namespace });
  }

  /**
   * Yields pod events from periodic polling. Polls immediately on entry,
   * then waits pollInterval between cycles. Runs indefinitely until
   * MAX_POLL_FAILURES consecutive errors (throws AggregateError).
   * Returns gracefully when the optional signal is aborted.
   *
   * @param signal - Optional AbortSignal to stop polling (used for timed watch retries)
   * @returns The latest resourceVersion from the last successful list, for resuming watch
   */
  private async *pollEvents(signal?: AbortSignal): AsyncGenerator<PodEvent, string | undefined> {
    const pollInterval = this.config.get("POD_POLL_INTERVAL_MS");
    const consecutiveErrors: Error[] = [];
    let lastResourceVersion: string | undefined;

    this.loggerService.info({ event: "POLLING_STARTED", pollInterval });

    try {
      while (!signal?.aborted) {
        try {
          const { pods: currentPods, resourceVersion } = await this.discoverPodsInNamespace();
          lastResourceVersion = resourceVersion;
          yield* this.reconcilePolledPods(currentPods);
          consecutiveErrors.length = 0;
        } catch (error) {
          consecutiveErrors.push(error instanceof Error ? error : new Error(String(error)));
          this.loggerService.error({ event: "POD_POLL_ERROR", error, consecutiveFailures: consecutiveErrors.length });

          if (consecutiveErrors.length >= this.MAX_POLL_FAILURES) {
            throw new AggregateError(consecutiveErrors, `Pod polling failed ${consecutiveErrors.length} times consecutively`);
          }
        }

        try {
          await delay(pollInterval, null, { signal });
        } catch {
          return lastResourceVersion;
        }
      }
    } finally {
      this.loggerService.info({ event: "POLLING_STOPPED" });
    }

    return lastResourceVersion;
  }

  /** Diffs polled pods against tracked state, yielding add/delete events. */
  private *reconcilePolledPods(currentPods: PodInfo[]): Generator<PodEvent> {
    const currentPodNames = new Set(currentPods.map(p => p.podName));

    for (const pod of currentPods) {
      if (!this.controllers.has(pod.podName)) {
        yield { type: "added", podInfo: pod };
      }
    }

    for (const podName of this.controllers.keys()) {
      if (!currentPodNames.has(podName)) {
        yield { type: "deleted", podName };
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Pod discovery & filtering
  // ---------------------------------------------------------------------------

  /**
   * Discovers all pods in the current namespace, excluding the current pod
   *
   * @returns Promise that resolves to discovered pods and the list's resourceVersion
   * @throws Error if namespace cannot be determined or Kubernetes API calls fail
   */
  async discoverPodsInNamespace(): Promise<{ pods: PodInfo[]; resourceVersion?: string }> {
    const namespace = this.getCurrentNamespace();

    this.loggerService.debug({ event: "POD_DISCOVERY_STARTED", namespace });

    const response = await this.k8sClient.listNamespacedPod({
      namespace,
      labelSelector: this.config.get("POD_LABEL_SELECTOR")
    });

    const resourceVersion = response.metadata?.resourceVersion;
    const currentPodName = this.config.get("HOSTNAME");
    const pods = response.items.filter(pod => this.isPodReady(pod)).map(pod => this.mapPodToInfo(pod, namespace));

    const targetPods = this.filterOutPodsFromSameDeployment(pods, currentPodName);

    this.loggerService.debug({
      event: "POD_DISCOVERY_COMPLETED",
      namespace,
      totalPods: response.items.length,
      readyPods: pods.length,
      targetPods: targetPods.length,
      currentPodName
    });

    return { pods: targetPods, resourceVersion };
  }

  // ---------------------------------------------------------------------------
  // Pod tracking
  // ---------------------------------------------------------------------------

  /**
   * Starts tracking a pod by creating an AbortController and invoking the callback.
   * Skips if the pod is already tracked (deduplication guard for watch events).
   *
   * @param podInfo - The pod to track
   * @param callback - Called with the pod info and an AbortSignal tied to this pod's lifecycle
   */
  private trackPod(podInfo: PodInfo, callback: PodCallback): void {
    if (this.controllers.has(podInfo.podName)) {
      return;
    }

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
   * @param podName - Name of the pod to untrack
   */
  private untrackPod(podName: string): void {
    const entry = this.controllers.get(podName);
    if (entry) {
      this.loggerService.info({
        event: "POD_DELETED",
        podName: entry.podInfo.podName,
        namespace: entry.podInfo.namespace
      });
      entry.ac.abort();
      this.controllers.delete(podName);
    }
  }

  // ---------------------------------------------------------------------------
  // Pod filtering utilities
  // ---------------------------------------------------------------------------

  /**
   * Filters a raw V1Pod through readiness and same-deployment checks.
   *
   * @param pod - Raw Kubernetes pod object
   * @returns PodInfo if the pod should be tracked, null otherwise
   */
  private processPod(pod: V1Pod): PodInfo | null {
    if (!this.isPodReady(pod)) {
      return null;
    }

    const namespace = this.getCurrentNamespace();
    const podInfo = this.mapPodToInfo(pod, namespace);
    const currentPodName = this.config.get("HOSTNAME");

    if (podInfo.podName === currentPodName || this.isPodFromSameDeployment(podInfo.podName, currentPodName)) {
      return null;
    }

    return podInfo;
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
    return pods.filter(pod => pod.podName !== currentPodName && !this.isPodFromSameDeployment(pod.podName, currentPodName));
  }

  // ---------------------------------------------------------------------------
  // Namespace resolution
  // ---------------------------------------------------------------------------

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
