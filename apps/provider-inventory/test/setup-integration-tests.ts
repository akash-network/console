/**
 * Cleanup strategy: per-test `TRUNCATE provider_inventory RESTART IDENTITY CASCADE`.
 * Migrations are run once per file in `beforeAll` (see TestDatabaseService).
 */
import "reflect-metadata";

import { beforeEach } from "vitest";

import { createTestDb } from "./setup-db";

export const testDb = createTestDb();

beforeEach(async () => {
  await testDb.truncate();
});
