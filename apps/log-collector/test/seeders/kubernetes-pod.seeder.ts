import { faker } from "@faker-js/faker";
import type { V1Container, V1ObjectMeta, V1Pod, V1PodSpec, V1PodStatus } from "@kubernetes/client-node";

/**
 * Seeds test data for Kubernetes V1Pod objects
 */
export function seedKubernetesPodTestData(overrides: Partial<V1Pod> = {}): V1Pod {
  const podName = faker.internet.domainWord();
  const namespace = faker.internet.domainWord();
  const containerNames = faker.helpers.arrayElements(["nginx", "app", "sidecar", "init", "proxy", "cache", "db", "redis"], { min: 1, max: 3 });

  const containers: V1Container[] = containerNames.map(name => ({ name }));

  return {
    metadata: {
      name: podName,
      namespace: namespace,
      labels: {
        app: faker.internet.domainWord(),
        version: faker.system.semver(),
        environment: faker.helpers.arrayElement(["dev", "staging", "prod"])
      },
      annotations: {
        "kubernetes.io/created-by": "controller",
        "prometheus.io/scrape": "true"
      }
    } as V1ObjectMeta,
    spec: {
      containers,
      nodeName: faker.internet.domainWord()
    } as V1PodSpec,
    status: {
      phase: faker.helpers.arrayElement(["Running", "Pending", "Succeeded", "Failed", "Unknown"]),
      podIP: faker.internet.ip()
    } as V1PodStatus,
    ...overrides
  };
}
