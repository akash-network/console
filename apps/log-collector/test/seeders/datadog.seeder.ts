import { faker } from "@faker-js/faker";

import type { DatadogLogEntry } from "@src/services/datadog-destination/datadog.service";
import type { LogMetadata } from "@src/types/log-destination.interface";

export interface DatadogTestData {
  logMessage: string;
  metadata: LogMetadata;
}

export function seedDatadogTestData(overrides: Partial<DatadogTestData> = {}): DatadogTestData {
  return {
    logMessage: faker.lorem.sentence(),
    metadata: {
      source: faker.company.name(),
      environment: faker.helpers.arrayElement(["development", "staging", "production"]),
      tags: {
        namespace: faker.internet.domainWord(),
        pod: faker.internet.domainWord(),
        service: faker.internet.domainWord(),
        kubernetes_namespace: faker.internet.domainWord(),
        kubernetes_pod: faker.internet.domainWord()
      },
      hostname: faker.internet.domainName(),
      service: faker.internet.domainWord(),
      namespace: faker.internet.domainWord(),
      podName: faker.internet.domainWord()
    },
    ...overrides
  };
}

export function seedDatadogLogEntry(logMessage: string, metadata: LogMetadata): DatadogLogEntry {
  return {
    ddsource: metadata.source,
    ddtags: `env:${metadata.environment},namespace:${metadata.tags.namespace},pod:${metadata.tags.pod},service:${metadata.tags.service},kubernetes_namespace:${metadata.tags.kubernetes_namespace},kubernetes_pod:${metadata.tags.kubernetes_pod}`,
    hostname: metadata.hostname,
    message: logMessage.trim(),
    service: metadata.service
  };
}
