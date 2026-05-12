import "reflect-metadata";

import { container } from "tsyringe";
import { afterAll, beforeAll, expect } from "vitest";

import { TestDatabaseService } from "./services/test-database.service";

const testPath = expect.getState().testPath;
if (!testPath) {
  throw new Error("Unable to detect test path for functional setup");
}

export const testDb = new TestDatabaseService(testPath);

beforeAll(async () => {
  await testDb.setup();
}, 30_000);

afterAll(async () => {
  try {
    await container.dispose();
  } catch {
    // container may already be disposed
  }
  await testDb.teardown();
}, 30_000);
