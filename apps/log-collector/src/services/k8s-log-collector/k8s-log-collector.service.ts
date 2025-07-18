import { CoreV1Api, KubeConfig, Log } from "@kubernetes/client-node";
import { V1Pod } from "@kubernetes/client-node/dist/gen/models/V1Pod";
import { PassThrough } from "stream";
import { singleton } from "tsyringe";

import { ConfigService } from "@src/services/config/config.service";
import { LoggerService } from "@src/services/logger/logger.service";
import { LogDestinationService, LogMetadata } from "@src/types/log-destination.interface";

interface PodInfo {
  podName: string;
  status?: string;
  podIP?: string;
  nodeName?: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

interface LogStreamOptions {
  follow: boolean;
  tailLines: number;
  pretty: boolean;
  timestamps: boolean;
}

@singleton()
export class K8sLogCollectorService {
  private readonly DEFAULT_NAMESPACE = "default";
  private readonly DEFAULT_LOG_STREAM_OPTIONS: LogStreamOptions = {
    follow: true,
    tailLines: 10,
    pretty: false,
    timestamps: true
  };

  constructor(
    private readonly k8sClient: CoreV1Api,
    private readonly k8sLogClient: Log,
    private readonly kubeConfig: KubeConfig,
    private readonly config: ConfigService,
    private readonly loggerService: LoggerService
  ) {
    this.loggerService.setContext(K8sLogCollectorService.name);
  }

  async collectLogs(logDestination: LogDestinationService): Promise<void> {
    try {
      const currentPodName = this.getCurrentPodName();
      const namespace = this.getCurrentNamespace();

      this.loggerService.info({ currentPodName, namespace, message: "Starting log collection" });

      const pods = await this.discoverPodsInNamespace(namespace);
      if (pods.length === 0) {
        this.loggerService.warn({ namespace, message: "No pods found in namespace" });
        return;
      }

      const targetPods = this.filterOutCurrentPod(pods, currentPodName);
      this.logDiscoveredPods(namespace, targetPods);

      await this.startLogStreams(namespace, targetPods, logDestination);
    } catch (error) {
      this.loggerService.error({ error, message: "Error collecting logs" });
      throw error;
    }
  }

  private getCurrentPodName(): string {
    return this.config.get("HOSTNAME");
  }

  private getCurrentNamespace(): string {
    try {
      return this.config.get("KUBERNETES_NAMESPACE_OVERRIDE") || this.getNamespaceFromKubeConfig();
    } catch (error) {
      this.loggerService.error({ error, message: "Could not read namespace from kubeconfig, using default" });
      return this.DEFAULT_NAMESPACE;
    }
  }

  private getNamespaceFromKubeConfig(): string {
    const currentContext = this.kubeConfig.getCurrentContext();
    this.loggerService.debug({ currentContext });

    if (!currentContext) {
      this.loggerService.warn({ message: "No current context found in kubeconfig" });
      return this.DEFAULT_NAMESPACE;
    }

    const context = this.kubeConfig.getContextObject(currentContext);
    this.loggerService.debug({ context });

    if (!context) {
      this.loggerService.warn({ message: "No context object found for current context" });
      return this.DEFAULT_NAMESPACE;
    }

    const namespace = context.namespace;

    if (!namespace) {
      this.loggerService.warn({ message: "No namespace provided in k8s context, using default" });
      return this.DEFAULT_NAMESPACE;
    }

    this.loggerService.info({ namespace, source: "kubeconfig" });

    return namespace;
  }

  private async discoverPodsInNamespace(namespace: string): Promise<PodInfo[]> {
    const podsResponse = await this.k8sClient.listNamespacedPod({ namespace });
    return podsResponse.items.map(pod => this.mapPodToInfo(pod));
  }

  private mapPodToInfo(pod: V1Pod): PodInfo {
    return {
      podName: pod.metadata?.name || "",
      status: pod.status?.phase,
      podIP: pod.status?.podIP,
      nodeName: pod.spec?.nodeName,
      labels: pod.metadata?.labels || {},
      annotations: pod.metadata?.annotations || {}
    };
  }

  private filterOutCurrentPod(pods: PodInfo[], currentPodName: string): PodInfo[] {
    const targetPods = pods.filter(pod => pod.podName !== currentPodName);

    if (pods.length !== targetPods.length) {
      this.loggerService.info({ podName: currentPodName, message: "Skipping current pod" });
    }

    return targetPods;
  }

  private logDiscoveredPods(namespace: string, pods: PodInfo[]): void {
    this.loggerService.info({
      namespace,
      podCount: pods.length,
      pods,
      message: "Discovered pods in namespace"
    });
  }

  private async startLogStreams(namespace: string, pods: PodInfo[], logDestination: LogDestinationService): Promise<void> {
    this.loggerService.info({
      targetPodCount: pods.length,
      message: "Starting log streams... Press Ctrl+C to stop"
    });

    const streamPromises = pods.map(pod => this.streamPodLogs(namespace, pod.podName, logDestination));

    await Promise.all(streamPromises);
  }

  private async streamPodLogs(namespace: string, podName: string, logDestination: LogDestinationService): Promise<void> {
    try {
      this.loggerService.info({ podName, namespace, message: "Starting log stream for pod" });

      const containerName = await this.getContainerName(namespace, podName);
      this.loggerService.info({ podName, containerName: containerName || "default", message: "Using container" });

      const logStream = this.createLogStream(podName, namespace, logDestination);
      await this.startKubernetesLogStream(namespace, podName, containerName, logStream);

      this.loggerService.info({ podName, message: "Log stream started for pod" });
    } catch (error) {
      this.loggerService.error({ error, podName, namespace, message: "Error streaming logs from pod" });
    }
  }

  private async getContainerName(namespace: string, podName: string): Promise<string> {
    const podResponse = await this.k8sClient.readNamespacedPod({ name: podName, namespace });
    const containers = podResponse.spec?.containers || [];
    return containers.length > 0 ? containers[0].name : "";
  }

  private createLogStream(podName: string, namespace: string, logDestination: LogDestinationService): PassThrough {
    const logStream = new PassThrough();

    logStream.on("data", async chunk => {
      this.writeToConsole(podName, chunk);
      await this.sendToDestination(chunk, podName, namespace, logDestination);
    });

    return logStream;
  }

  private writeToConsole(podName: string, chunk: Buffer): void {
    if (this.config.get("WRITE_TO_CONSOLE")) {
      process.stdout.write(`[${podName}] ${chunk}`);
    }
  }

  private async sendToDestination(chunk: Buffer, podName: string, namespace: string, logDestination: LogDestinationService): Promise<void> {
    const metadata = this.createLogMetadata(podName, namespace);

    try {
      await logDestination.sendLog(chunk.toString(), metadata);
    } catch (error) {
      this.loggerService.error({ error, podName, message: "Error in log destination for pod" });
    }
  }

  private createLogMetadata(podName: string, namespace: string): LogMetadata {
    return {
      source: this.config.get("SOURCE"),
      environment: this.config.get("ENVIRONMENT"),
      tags: {
        namespace,
        pod: podName,
        service: podName,
        kubernetes_namespace: namespace,
        kubernetes_pod: podName
      },
      hostname: podName,
      service: podName,
      namespace,
      podName
    };
  }

  private async startKubernetesLogStream(namespace: string, podName: string, containerName: string, logStream: PassThrough): Promise<void> {
    await this.k8sLogClient.log(namespace, podName, containerName, logStream, this.DEFAULT_LOG_STREAM_OPTIONS);
  }
}
