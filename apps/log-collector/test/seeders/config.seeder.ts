import { faker } from "@faker-js/faker";

export interface ConfigTestData extends Record<string, string | undefined> {
  HOSTNAME: string;
  KUBERNETES_NAMESPACE_OVERRIDE?: string;
  LOG_DIR?: string;
  LOG_MAX_FILE_SIZE_BYTES?: string;
  LOG_MAX_ROTATED_FILES?: string;
}

export function seedConfigTestData(overrides: Partial<ConfigTestData> = {}): ConfigTestData {
  return {
    HOSTNAME: faker.internet.domainWord(),
    LOG_DIR: "./log",
    LOG_MAX_FILE_SIZE_BYTES: (10 * 1024 * 1024).toString(),
    LOG_MAX_ROTATED_FILES: "5",
    ...overrides
  };
}
