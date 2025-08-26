import { CoreV1Api, KubeConfig, V1Pod } from "@kubernetes/client-node";
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

/**
 * Discovers Kubernetes pods in the current namespace for log collection
 *
 * This service handles:
 * - Discovering all pods in the current namespace
 * - Filtering out the current pod (to avoid self-collection)
 * - Mapping Kubernetes pod objects to simplified PodInfo structures
 * - Determining the current namespace from kubeconfig or environment
 * - Providing pod metadata needed for log collection
 *
 * The service supports namespace override via environment variables
 * and automatically excludes the current pod from discovery to prevent
 * infinite log collection loops.
 */
@singleton()
export class PodDiscoveryService {
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
   * Discovers all pods in the current namespace, excluding the current pod
   *
   * This method:
   * 1. Determines the current namespace from config or kubeconfig
   * 2. Lists all pods in the namespace using the Kubernetes API
   * 3. Maps raw pod objects to simplified PodInfo structures
   * 4. Filters out the current pod to prevent self-collection
   * 5. Logs discovery statistics
   *
   * @returns Promise that resolves to an array of PodInfo objects for discovered pods
   * @throws Error if namespace cannot be determined or Kubernetes API calls fail
   */
  async discoverPodsInNamespace(): Promise<PodInfo[]> {
    const namespace = this.getCurrentNamespace();

    this.loggerService.info({ message: "Discovering pods in namespace", namespace });

    const { items: podsRaw } = await this.k8sClient.listNamespacedPod({ namespace });
    const pods = podsRaw.map(pod => this.mapPodToInfo(pod, namespace));

    const currentPodName = this.config.get("HOSTNAME");
    const targetPods = this.filterOutPodsFromSameDeployment(pods, currentPodName);

    this.loggerService.info({
      namespace,
      totalPods: pods.length,
      targetPods: targetPods.length,
      currentPodName,
      message: "Pod discovery completed"
    });

    return targetPods;
  }

  /**
   * Determines the current namespace for pod discovery
   *
   * Checks for a namespace override in configuration first, then falls back
   * to extracting the namespace from the current Kubernetes context.
   *
   * @returns The namespace to discover pods in
   * @throws Error if namespace cannot be determined from config or kubeconfig
   */
  private getCurrentNamespace(): string {
    const overrideNamespace = this.config.get("KUBERNETES_NAMESPACE_OVERRIDE");
    if (overrideNamespace) {
      return overrideNamespace;
    }

    return this.getNamespaceFromKubeConfig();
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
    this.loggerService.debug({ currentContext });

    const context = this.kubeConfig.getContextObject(currentContext);
    this.loggerService.debug({ context });

    if (!context) {
      throw new Error(`Context object not found for current context: ${currentContext}`);
    }

    const namespace = context.namespace;

    if (!namespace) {
      throw new Error(`No namespace provided in k8s context: ${currentContext}. Please set namespace in context or provide KUBERNETES_NAMESPACE_OVERRIDE`);
    }

    this.loggerService.info({ namespace, source: "kubeconfig" });

    return namespace;
  }

  /**
   * Maps a Kubernetes V1Pod object to a simplified PodInfo structure
   *
   * Extracts relevant information from the raw Kubernetes pod object
   * and creates a simplified structure containing only the data needed
   * for log collection operations.
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

  /**
   * Filters out all pods from the same deployment as the current pod
   *
   * Extracts the deployment name from the current pod name by removing the last two parts
   * (which typically represent the deployment ID and replica ID). Then filters out all pods
   * that start with that deployment name to prevent the log collector from collecting logs
   * from other pods in the same deployment.
   *
   * For example:
   * - "log-collector-6bdb59678c-w9jww" -> extracts "log-collector" -> excludes all "log-collector-*" pods
   * - "web-78d5c9c5b-hxqxs" -> extracts "web" -> excludes all "web-*" pods
   *
   * @param pods - Array of discovered pods
   * @param currentPodName - Name of the current pod
   * @returns Array of pods excluding all pods from the same deployment
   */
  private filterOutPodsFromSameDeployment(pods: PodInfo[], currentPodName: string): PodInfo[] {
    const parts = currentPodName.split("-");

    if (parts.length < 3) return pods;

    const deploymentName = parts.slice(0, -2).join("-");

    return pods.filter(pod => !pod.podName.startsWith(deploymentName + "-"));
  }
}
