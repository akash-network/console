import { faker } from "@faker-js/faker";

import type { PodInfo } from "@src/services/pod-discovery/pod-discovery.service";

/**
 * Seeds test data for PodInfo objects
 */
export function seedPodInfoTestData(overrides: Partial<PodInfo> = {}): PodInfo {
  return {
    podName: faker.internet.domainWord(),
    namespace: faker.internet.domainWord(),
    status: faker.helpers.arrayElement(["Running", "Pending", "Succeeded", "Failed", "Unknown"]),
    podIP: faker.internet.ip(),
    nodeName: faker.internet.domainWord(),
    labels: {
      app: faker.internet.domainWord(),
      version: faker.system.semver(),
      environment: faker.helpers.arrayElement(["dev", "staging", "prod"])
    },
    annotations: {
      "kubernetes.io/created-by": "controller",
      "prometheus.io/scrape": "true"
    },
    containerNames: faker.helpers.arrayElements(["nginx", "app", "sidecar", "init", "proxy", "cache", "db", "redis"], { min: 1, max: 3 }),
    ...overrides
  };
}
