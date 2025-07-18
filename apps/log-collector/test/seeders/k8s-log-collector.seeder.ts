import { faker } from "@faker-js/faker";
import type { V1Pod } from "@kubernetes/client-node";

import type { LogDestinationService, LogMetadata } from "@src/types/log-destination.interface";

export interface K8sTestData {
  currentPodName: string;
  namespace: string;
  pods: V1Pod[];
  logDestination: LogDestinationService;
}

export function seedK8sTestData(overrides: Partial<K8sTestData> = {}): K8sTestData {
  const currentPodName = faker.internet.domainWord();
  const namespace = faker.internet.domainWord();

  return {
    currentPodName,
    namespace,
    pods: [
      {
        metadata: {
          name: currentPodName,
          labels: { app: "test-app" },
          annotations: { "test.annotation": "value" }
        },
        status: {
          phase: "Running",
          podIP: faker.internet.ip(),
          hostIP: faker.internet.ip()
        },
        spec: {
          nodeName: faker.internet.domainWord(),
          containers: [{ name: "main-container" }]
        }
      },
      {
        metadata: {
          name: faker.internet.domainWord(),
          labels: { app: "other-app" },
          annotations: {}
        },
        status: {
          phase: "Running",
          podIP: faker.internet.ip(),
          hostIP: faker.internet.ip()
        },
        spec: {
          nodeName: faker.internet.domainWord(),
          containers: [{ name: "other-container" }]
        }
      }
    ],
    logDestination: {
      sendLog: jest.fn().mockResolvedValue(undefined)
    } as LogDestinationService,
    ...overrides
  };
}

export function seedLogMetadata(podName: string, namespace: string): LogMetadata {
  return {
    source: faker.company.name(),
    environment: faker.helpers.arrayElement(["development", "staging", "production"]),
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
