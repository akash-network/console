import "reflect-metadata";

import { TestDatabaseService } from "./services/test-database.service";

const testPath = expect.getState().testPath;

if (!testPath) {
  console.error("Unable to detect test path to initialize db");
  process.exit(1);
}

const EXCLUSIONS = ["http-tools.spec.ts"];

if (!EXCLUSIONS.some(path => testPath.endsWith(path))) {
  const dbService = new TestDatabaseService(testPath);
  beforeAll(async () => {
    await dbService.setup();
  }, 10000);

  afterAll(async () => {
    await dbService.teardown();
  }, 10000);
}
