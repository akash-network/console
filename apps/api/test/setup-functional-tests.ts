import "reflect-metadata";

import { container } from "tsyringe";

import { cacheEngine } from "@src/caching/helpers";
import { TestDatabaseService } from "./services/test-database.service";

const testPath = expect.getState().testPath;
const dbService = new TestDatabaseService(testPath!);

/**
 * Test helper for targeted cache invalidation
 * @param keyOrPrefix - Specific key or prefix to clear. If not provided, clears all cache.
 */
export function clearCache(keyOrPrefix?: string) {
  if (!keyOrPrefix) {
    cacheEngine.clearAllKeyInCache();
  } else if (keyOrPrefix.includes("*")) {
    // Handle wildcard patterns if needed in the future
    const prefix = keyOrPrefix.replace("*", "");
    cacheEngine.clearByPrefix(prefix);
  } else {
    // Check if it's a prefix by looking for keys that start with it
    const keys = cacheEngine.getKeys();
    const isPrefix = keys.some((key: string) => key.startsWith(keyOrPrefix) && key !== keyOrPrefix);

    if (isPrefix) {
      cacheEngine.clearByPrefix(keyOrPrefix);
    } else {
      cacheEngine.clearByKey(keyOrPrefix);
    }
  }
}

beforeAll(async () => {
  cacheEngine.clearAllKeyInCache();
  await dbService.setup();
}, 20000);

afterAll(async () => {
  try {
    await container.dispose();
  } catch {
    // could be disposed in tests
  }
  await dbService.teardown();
  cacheEngine.clearAllKeyInCache();
}, 20000);

beforeEach(() => {
  cacheEngine.clearAllKeyInCache();
});

afterEach(() => {
  cacheEngine.clearAllKeyInCache();
});

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
