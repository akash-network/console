import "reflect-metadata";

import { TestDatabaseService } from "./services/test-database.service";

const testPath = expect.getState().testPath;
const dbService = new TestDatabaseService(testPath!);

beforeAll(async () => {
  await dbService.setup();
}, 10000);

afterAll(async () => {
  await dbService.teardown();
}, 10000);

expect.extend({
  toBeTypeOrNull(received: unknown, type: StringConstructor) {
    try {
      expect(received).toEqual(expect.any(type));
      return {
        message: () => `Ok`,
        pass: true
      };
    } catch (error) {
      return received === null
        ? {
            message: () => `Ok`,
            pass: true
          }
        : {
            message: () => `expected ${received} to be ${type} type or null`,
            pass: false
          };
    }
  },

  dateTimeZ(received: string) {
    const pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})Z$/;
    const pass = pattern.test(received);

    return {
      pass,
      message: () => `expected ${received} to be a UTC datetime string with milliseconds`
    };
  }
});
