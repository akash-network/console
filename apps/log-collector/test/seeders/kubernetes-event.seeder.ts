import { faker } from "@faker-js/faker";
import type { CoreV1Event } from "@kubernetes/client-node";

export function seedKubernetesEventTestData(overrides: Partial<CoreV1Event> = {}): CoreV1Event {
  const namespace = faker.internet.domainWord();
  const podName = faker.internet.domainWord();

  return {
    metadata: {
      name: faker.string.alphanumeric(10),
      resourceVersion: String(faker.number.int({ min: 1, max: 10000 }))
    },
    type: faker.helpers.arrayElement(["Normal", "Warning"]),
    reason: faker.helpers.arrayElement(["Scheduled", "Pulling", "Pulled", "Created", "Started", "BackOff", "Failed", "OOMKilling", "Unhealthy"]),
    message: faker.lorem.sentence(),
    involvedObject: { kind: "Pod", name: podName, namespace },
    source: {
      component: faker.helpers.arrayElement(["default-scheduler", "kubelet", "replicaset-controller"]),
      host: faker.internet.domainWord()
    },
    count: faker.number.int({ min: 1, max: 20 }),
    // K8s Watch API returns timestamps as ISO strings, not Date objects, despite the type definition
    firstTimestamp: faker.date.recent().toISOString() as unknown as Date,
    lastTimestamp: faker.date.recent().toISOString() as unknown as Date,
    eventTime: undefined,
    ...overrides
  };
}
