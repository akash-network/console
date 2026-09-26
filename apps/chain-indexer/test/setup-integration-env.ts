import "reflect-metadata";

import { container } from "tsyringe";
import { afterAll, beforeAll, expect } from "vitest";

import { TestDatabaseService } from "@test/services/test-database.service";

const dbService = new TestDatabaseService(expect.getState().testPath!);

beforeAll(async () => {
  await dbService.setup();
}, 30_000);

afterAll(async () => {
  await container.dispose();
  await dbService.teardown();
}, 30_000);
