import { faker } from "@faker-js/faker";

export interface ConfigTestData extends Record<string, string | undefined> {
  HOSTNAME: string;
  KUBERNETES_NAMESPACE_OVERRIDE?: string;
  DESTINATION: "DATADOG";
  DD_SITE: string;
  DD_API_KEY: string;
  ENVIRONMENT?: string;
  SOURCE?: string;
  WRITE_TO_CONSOLE?: "true" | "false";
  DATADOG_DEBUG?: "true" | "false";
}

export function seedConfigTestData(overrides: Partial<ConfigTestData> = {}): ConfigTestData {
  return {
    HOSTNAME: faker.internet.domainWord(),
    DESTINATION: "DATADOG",
    DD_SITE: faker.internet.domainName(),
    DD_API_KEY: faker.string.alphanumeric(32),
    ENVIRONMENT: faker.helpers.arrayElement(["development", "staging", "production"]),
    SOURCE: faker.company.name(),
    WRITE_TO_CONSOLE: "false",
    DATADOG_DEBUG: "false",
    ...overrides
  };
}

export function seedMinimalConfigTestData(overrides: Partial<ConfigTestData> = {}): ConfigTestData {
  return {
    HOSTNAME: faker.internet.domainWord(),
    DESTINATION: "DATADOG",
    DD_SITE: faker.internet.domainName(),
    DD_API_KEY: faker.string.alphanumeric(32),
    ...overrides
  };
}
