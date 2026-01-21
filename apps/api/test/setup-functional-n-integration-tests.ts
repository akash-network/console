import "reflect-metadata";

import { container } from "tsyringe";

import { cacheEngine } from "@src/caching/helpers";
import { TestDatabaseService } from "./services/test-database.service";

const testPath = expect.getState().testPath;
const dbService = new TestDatabaseService(testPath!);

beforeAll(async () => {
  cacheEngine.clearAllKeyInCache();
  await dbService.setup();
}, 20_000);

afterAll(async () => {
  try {
    await container.dispose();
  } catch {
    // could be disposed in tests
  }
  await dbService.teardown();
  cacheEngine.clearAllKeyInCache();
}, 20_000);

beforeEach(() => {
  cacheEngine.clearAllKeyInCache();
});

afterEach(() => {
  cacheEngine.clearAllKeyInCache();
});
