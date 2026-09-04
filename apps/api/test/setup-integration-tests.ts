import "reflect-metadata";

import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, beforeEach, expect } from "vitest";

import MemoryCacheEngine from "@src/caching/memoryCacheEngine";
import { TestDatabaseService } from "./services/test-database.service";

const testPath = expect.getState().testPath;
const dbService = new TestDatabaseService(testPath!);

beforeAll(async () => {
  MemoryCacheEngine.clearAllCaches();
  await dbService.setup();
}, 20_000);

afterAll(async () => {
  try {
    await container.dispose();
  } catch {
    // could be disposed in tests
  }
  await dbService.teardown();
  MemoryCacheEngine.clearAllCaches();
}, 20_000);

beforeEach(() => {
  MemoryCacheEngine.clearAllCaches();
});

afterEach(() => {
  MemoryCacheEngine.clearAllCaches();
});
