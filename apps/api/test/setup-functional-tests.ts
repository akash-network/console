import "reflect-metadata";

import { TestDatabaseService } from "./services/test-database.service";

const testPath = expect.getState().testPath;
const dbService = new TestDatabaseService(testPath);

beforeAll(async () => {
  await dbService.setup();
}, 10000);

afterAll(async () => {
  await dbService.teardown();
}, 10000);
