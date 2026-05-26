import { container } from "tsyringe";
import { afterAll, beforeAll, expect } from "vitest";

import { TestDatabaseService } from "./services/test-database.service";

/**
 * Shared helper used by functional and integration setup files.
 *
 * Each test file gets its own isolated Postgres database (created in
 * `beforeAll`, dropped in `afterAll`). Migrations are run once per file.
 * Tests that share a project should call `testDb.truncate()` between cases
 * to keep state clean — integration setup wires this in automatically.
 */
export function createTestDb(): TestDatabaseService {
  const testPath = expect.getState().testPath;
  if (!testPath) {
    throw new Error("Unable to detect test path for database setup");
  }

  const testDb = new TestDatabaseService(testPath);

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

  return testDb;
}
