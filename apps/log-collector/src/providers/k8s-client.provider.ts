/**
 * Kubernetes client provider for dependency injection
 *
 * Registers Kubernetes client dependencies (KubeConfig, CoreV1Api, Log) as injectable
 * services. The KubeConfig is loaded from default sources (kubeconfig file, environment
 * variables, etc.) and used to create API clients.
 */
import { CoreV1Api, KubeConfig, Log } from "@kubernetes/client-node";
import { container } from "tsyringe";

// Register KubeConfig with default configuration
container.register(KubeConfig, {
  useFactory: () => {
    const kc = new KubeConfig();
    kc.loadFromDefault();
    return kc;
  }
});

// Register CoreV1Api client using the configured KubeConfig
container.register(CoreV1Api, {
  useFactory: c => {
    const kc = c.resolve(KubeConfig);
    return kc.makeApiClient(CoreV1Api);
  }
});

// Register Log client using the configured KubeConfig
container.register(Log, {
  useFactory: c => {
    const kc = c.resolve(KubeConfig);
    return new Log(kc);
  }
});
